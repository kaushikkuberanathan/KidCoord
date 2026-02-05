/**
 * Offer/Request API Routes
 * Handles the unified offer/request flow that connects Needs with Availabilities
 * 
 * Key Concepts:
 * - OFFER: Driver with availability offers to fulfill a need
 * - REQUEST: Parent with need requests a specific driver's availability
 * - Accept creates RideSession atomically
 * - Other pending offers auto-decline
 */

import { Router, Request, Response } from 'express';
import { query, transaction, generateId } from '@/utils/database';
import { logger } from '@/utils/logger';
import {
  validateOfferRequestTransition,
  validateNeedTransition,
  validateRideSessionTransition,
  OfferRequestStatus,
  NeedStatus,
  RideSessionStatus,
  AvailabilityStatus,
} from '@/utils/stateMachine';
import { requireIdempotency } from '@/middleware/idempotency';

const router = Router();

// ============================================================================
// TYPES
// ============================================================================

interface CreateOfferRequestRequest {
  type: 'OFFER' | 'REQUEST';
  needId: string;
  availabilityId: string;
  message?: string;
}

interface RespondToOfferRequestRequest {
  action: 'ACCEPT' | 'DECLINE';
  message?: string;
}

interface OfferRequest {
  offer_request_id: string;
  type: 'OFFER' | 'REQUEST';
  need_id: string;
  availability_id: string;
  from_member_id: string;
  to_member_id: string;
  message: string | null;
  status: OfferRequestStatus;
  ride_session_id: string | null;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
}

// ============================================================================
// POST /offer-requests - Send offer or request
// ============================================================================

router.post('/', requireIdempotency, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const body: CreateOfferRequestRequest = req.body;
    
    // Validation
    if (!body.type || !body.needId || !body.availabilityId) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields',
          details: {
            required: ['type', 'needId', 'availabilityId'],
          },
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    if (!['OFFER', 'REQUEST'].includes(body.type)) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Type must be OFFER or REQUEST',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Get Need and verify it's OPEN
    const needResult = await query(
      `SELECT n.*, c.household_id, c.first_name, c.last_initial,
              hm.household_member_id as need_owner_member_id
       FROM needs n
       JOIN children c ON n.child_id = c.child_id
       JOIN household_members hm ON c.household_id = hm.household_id
       WHERE n.need_id = $1 AND hm.user_id = (
         SELECT user_id FROM children WHERE child_id = n.child_id LIMIT 1
       )`,
      [body.needId]
    );
    
    if (needResult.rows.length === 0) {
      return res.status(404).json({
        requestId: (req as any).id,
        error: {
          code: 'NOT_FOUND',
          message: 'Need not found',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const need = needResult.rows[0];
    
    if (need.status !== NeedStatus.OPEN) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'INVALID_STATE',
          message: `Need is ${need.status}, must be OPEN`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Get Availability and verify it's ACTIVE with seats
    const availabilityResult = await query(
      `SELECT a.*, v.household_id, hm.household_member_id as driver_member_id
       FROM availabilities a
       JOIN vehicles v ON a.vehicle_id = v.vehicle_id
       JOIN household_members hm ON a.household_member_id = hm.household_member_id
       WHERE a.availability_id = $1`,
      [body.availabilityId]
    );
    
    if (availabilityResult.rows.length === 0) {
      return res.status(404).json({
        requestId: (req as any).id,
        error: {
          code: 'NOT_FOUND',
          message: 'Availability not found',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const availability = availabilityResult.rows[0];
    
    if (availability.status !== AvailabilityStatus.ACTIVE) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'INVALID_STATE',
          message: `Availability is ${availability.status}, must be ACTIVE`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    if (availability.seats_available < 1) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'NO_SEATS_AVAILABLE',
          message: 'No seats available on this availability',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Verify dates match
    if (need.date !== availability.date) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Need and Availability must be for the same date',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Get current user's member ID
    const userMemberResult = await query(
      'SELECT household_member_id FROM household_members WHERE user_id = $1 AND status = $2',
      [userId, 'active']
    );
    
    if (userMemberResult.rows.length === 0) {
      return res.status(403).json({
        requestId: (req as any).id,
        error: {
          code: 'FORBIDDEN',
          message: 'User has no active household membership',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const currentMemberId = userMemberResult.rows[0].household_member_id;
    
    // Determine from/to based on type
    let fromMemberId: string;
    let toMemberId: string;
    
    if (body.type === 'OFFER') {
      // Driver offers to parent
      fromMemberId = availability.driver_member_id;
      toMemberId = need.need_owner_member_id;
      
      // Verify current user is the driver
      if (currentMemberId !== fromMemberId) {
        return res.status(403).json({
          requestId: (req as any).id,
          error: {
            code: 'FORBIDDEN',
            message: 'Only the driver can send an OFFER',
          },
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      // Parent requests driver
      fromMemberId = need.need_owner_member_id;
      toMemberId = availability.driver_member_id;
      
      // Verify current user owns the need
      if (currentMemberId !== fromMemberId) {
        return res.status(403).json({
          requestId: (req as any).id,
          error: {
            code: 'FORBIDDEN',
            message: 'Only the need owner can send a REQUEST',
          },
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    // Check for blocklist
    const blocklistResult = await query(
      `SELECT 1 FROM blocklists 
       WHERE child_id = $1 
       AND blocked_member_id = $2 
       AND status = $3`,
      [need.child_id, availability.driver_member_id, 'active']
    );
    
    if (blocklistResult.rows.length > 0) {
      return res.status(403).json({
        requestId: (req as any).id,
        error: {
          code: 'BLOCKED',
          message: 'This driver is blocked for this child',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Check for existing pending offer between same need and availability
    const existingResult = await query(
      `SELECT 1 FROM offer_requests 
       WHERE need_id = $1 
       AND availability_id = $2 
       AND status = $3`,
      [body.needId, body.availabilityId, OfferRequestStatus.SENT]
    );
    
    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        requestId: (req as any).id,
        error: {
          code: 'DUPLICATE_OFFER',
          message: 'A pending offer/request already exists between this need and availability',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Create OfferRequest
    const offerRequestId = generateId('offer_request');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration
    
    const insertResult = await query<OfferRequest>(
      `INSERT INTO offer_requests (
        offer_request_id, type, need_id, availability_id,
        from_member_id, to_member_id, message, status, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        offerRequestId,
        body.type,
        body.needId,
        body.availabilityId,
        fromMemberId,
        toMemberId,
        body.message || null,
        OfferRequestStatus.SENT,
        expiresAt,
      ]
    );
    
    const offerRequest = insertResult.rows[0];
    
    // Create audit event
    await query(
      `INSERT INTO audit_events (
        audit_event_id, event_type, actor_user_id, actor_member_id,
        household_id, entity_type, entity_id, event_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
      [
        generateId('audit'),
        body.type === 'OFFER' ? 'OFFER_SENT' : 'REQUEST_SENT',
        userId,
        currentMemberId,
        need.household_id,
        'OFFER_REQUEST',
        offerRequestId,
        {
          needId: body.needId,
          availabilityId: body.availabilityId,
          type: body.type,
        },
      ]
    );
    
    // Create notification in outbox
    await query(
      `INSERT INTO outbox_events (
        outbox_event_id, event_type, entity_type, entity_id,
        recipient_member_id, event_at, status, payload
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)`,
      [
        generateId('outbox'),
        body.type === 'OFFER' ? 'OFFER_RECEIVED' : 'REQUEST_RECEIVED',
        'OFFER_REQUEST',
        offerRequestId,
        toMemberId,
        'pending',
        {
          offerRequestId,
          needId: body.needId,
          availabilityId: body.availabilityId,
          message: body.message,
        },
      ]
    );
    
    logger.info('Offer/Request created', {
      offerRequestId,
      type: body.type,
      needId: body.needId,
      availabilityId: body.availabilityId,
      userId,
    });
    
    res.status(201).json({
      requestId: (req as any).id,
      data: {
        offerRequest: {
          id: offerRequest.offer_request_id,
          type: offerRequest.type,
          needId: offerRequest.need_id,
          availabilityId: offerRequest.availability_id,
          fromMemberId: offerRequest.from_member_id,
          toMemberId: offerRequest.to_member_id,
          message: offerRequest.message,
          status: offerRequest.status,
          expiresAt: offerRequest.expires_at,
          createdAt: offerRequest.created_at,
        },
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

// ============================================================================
// POST /offer-requests/:offerRequestId/respond - Accept or decline
// ============================================================================

router.post('/:offerRequestId/respond', requireIdempotency, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { offerRequestId } = req.params;
    const body: RespondToOfferRequestRequest = req.body;
    
    // Validation
    if (!body.action || !['ACCEPT', 'DECLINE'].includes(body.action)) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Action must be ACCEPT or DECLINE',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Use transaction for atomicity (ACCEPT creates RideSession)
    const result = await transaction(async (client) => {
      // Get OfferRequest with related data
      const offerResult = await client.query(
        `SELECT or.*, n.child_id, n.date, n.status as need_status,
                a.status as availability_status, a.seats_available,
                n.household_id as need_household_id
         FROM offer_requests or
         JOIN needs n ON or.need_id = n.need_id
         JOIN availabilities a ON or.availability_id = a.availability_id
         WHERE or.offer_request_id = $1
         FOR UPDATE`,
        [offerRequestId]
      );
      
      if (offerResult.rows.length === 0) {
        throw new Error('NOT_FOUND');
      }
      
      const offerRequest = offerResult.rows[0];
      
      // Verify current user is the recipient
      const userMemberResult = await client.query(
        'SELECT household_member_id FROM household_members WHERE user_id = $1 AND status = $2',
        [userId, 'active']
      );
      
      if (userMemberResult.rows.length === 0) {
        throw new Error('FORBIDDEN');
      }
      
      const currentMemberId = userMemberResult.rows[0].household_member_id;
      
      if (currentMemberId !== offerRequest.to_member_id) {
        throw new Error('NOT_RECIPIENT');
      }
      
      // Validate state transition
      const newStatus = body.action === 'ACCEPT' 
        ? OfferRequestStatus.ACCEPTED 
        : OfferRequestStatus.DECLINED;
      
      try {
        validateOfferRequestTransition(
          offerRequest.status as OfferRequestStatus,
          newStatus
        );
      } catch (error: any) {
        throw new Error(`INVALID_TRANSITION:${error.message}`);
      }
      
      // Verify need is still OPEN
      if (offerRequest.need_status !== NeedStatus.OPEN) {
        throw new Error(`NEED_NOT_OPEN:${offerRequest.need_status}`);
      }
      
      // Verify availability is still ACTIVE with seats
      if (offerRequest.availability_status !== AvailabilityStatus.ACTIVE) {
        throw new Error(`AVAILABILITY_NOT_ACTIVE:${offerRequest.availability_status}`);
      }
      
      if (body.action === 'ACCEPT' && offerRequest.seats_available < 1) {
        throw new Error('NO_SEATS_AVAILABLE');
      }
      
      let rideSessionId: string | null = null;
      
      if (body.action === 'ACCEPT') {
        // ACCEPT: Create RideSession atomically
        rideSessionId = generateId('ride_session');
        
        // Insert RideSession
        await client.query(
          `INSERT INTO ride_sessions (
            ride_session_id, need_id, availability_id, offer_request_id,
            child_id, driver_member_id, date, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            rideSessionId,
            offerRequest.need_id,
            offerRequest.availability_id,
            offerRequestId,
            offerRequest.child_id,
            offerRequest.from_member_id, // Driver is from_member_id in OFFER, to_member_id in REQUEST
            offerRequest.date,
            RideSessionStatus.ASSIGNED,
          ]
        );
        
        // Create RideParticipant
        await client.query(
          `INSERT INTO ride_participants (
            ride_participant_id, ride_session_id, child_id, role
          ) VALUES ($1, $2, $3, $4)`,
          [
            generateId('ride_participant'),
            rideSessionId,
            offerRequest.child_id,
            'rider',
          ]
        );
        
        // Update Need status to ASSIGNED
        await client.query(
          'UPDATE needs SET status = $1, ride_session_id = $2, updated_at = NOW() WHERE need_id = $3',
          [NeedStatus.ASSIGNED, rideSessionId, offerRequest.need_id]
        );
        
        // Decrement seats_available on Availability
        await client.query(
          'UPDATE availabilities SET seats_available = seats_available - 1, updated_at = NOW() WHERE availability_id = $1',
          [offerRequest.availability_id]
        );
        
        // Auto-decline all other SENT offers for this Need
        await client.query(
          `UPDATE offer_requests 
           SET status = $1, updated_at = NOW() 
           WHERE need_id = $2 
           AND offer_request_id != $3 
           AND status = $4`,
          [OfferRequestStatus.DECLINED, offerRequest.need_id, offerRequestId, OfferRequestStatus.SENT]
        );
        
        // Create audit event for RideSession creation
        await client.query(
          `INSERT INTO audit_events (
            audit_event_id, event_type, actor_user_id, actor_member_id,
            household_id, entity_type, entity_id, event_at, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
          [
            generateId('audit'),
            'RIDE_SESSION_CREATED',
            userId,
            currentMemberId,
            offerRequest.need_household_id,
            'RIDE_SESSION',
            rideSessionId,
            {
              needId: offerRequest.need_id,
              availabilityId: offerRequest.availability_id,
              offerRequestId,
            },
          ]
        );
      }
      
      // Update OfferRequest status
      const updateResult = await client.query(
        `UPDATE offer_requests 
         SET status = $1, ride_session_id = $2, updated_at = NOW() 
         WHERE offer_request_id = $3 
         RETURNING *`,
        [newStatus, rideSessionId, offerRequestId]
      );
      
      const updatedOfferRequest = updateResult.rows[0];
      
      // Create audit event for response
      await client.query(
        `INSERT INTO audit_events (
          audit_event_id, event_type, actor_user_id, actor_member_id,
          household_id, entity_type, entity_id, event_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
        [
          generateId('audit'),
          body.action === 'ACCEPT' ? 'OFFER_ACCEPTED' : 'OFFER_DECLINED',
          userId,
          currentMemberId,
          offerRequest.need_household_id,
          'OFFER_REQUEST',
          offerRequestId,
          {
            action: body.action,
            message: body.message,
          },
        ]
      );
      
      // Create notification
      await client.query(
        `INSERT INTO outbox_events (
          outbox_event_id, event_type, entity_type, entity_id,
          recipient_member_id, event_at, status, payload
        ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)`,
        [
          generateId('outbox'),
          body.action === 'ACCEPT' ? 'OFFER_ACCEPTED' : 'OFFER_DECLINED',
          'OFFER_REQUEST',
          offerRequestId,
          offerRequest.from_member_id, // Notify sender
          'pending',
          {
            offerRequestId,
            action: body.action,
            rideSessionId,
            message: body.message,
          },
        ]
      );
      
      return {
        offerRequest: updatedOfferRequest,
        rideSessionId,
      };
    });
    
    logger.info('Offer/Request responded', {
      offerRequestId,
      action: body.action,
      rideSessionId: result.rideSessionId,
      userId,
    });
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        offerRequest: {
          id: result.offerRequest.offer_request_id,
          status: result.offerRequest.status,
          rideSessionId: result.offerRequest.ride_session_id,
          updatedAt: result.offerRequest.updated_at,
        },
        rideSessionId: result.rideSessionId,
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    // Handle custom errors from transaction
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({
        requestId: (req as any).id,
        error: {
          code: 'NOT_FOUND',
          message: 'Offer/Request not found',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    if (error.message === 'FORBIDDEN' || error.message === 'NOT_RECIPIENT') {
      return res.status(403).json({
        requestId: (req as any).id,
        error: {
          code: 'FORBIDDEN',
          message: 'Only the recipient can respond to this offer/request',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    if (error.message.startsWith('INVALID_TRANSITION:')) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'INVALID_TRANSITION',
          message: error.message.split(':')[1],
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    if (error.message.startsWith('NEED_NOT_OPEN:')) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'NEED_NOT_OPEN',
          message: `Need is ${error.message.split(':')[1]}, cannot accept offer`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    if (error.message.startsWith('AVAILABILITY_NOT_ACTIVE:')) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'AVAILABILITY_NOT_ACTIVE',
          message: `Availability is ${error.message.split(':')[1]}, cannot accept offer`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    if (error.message === 'NO_SEATS_AVAILABLE') {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'NO_SEATS_AVAILABLE',
          message: 'No seats available, cannot accept offer',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    throw error;
  }
});

// ============================================================================
// GET /offer-requests - Query offer/requests (inbox)
// ============================================================================

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const {
      direction, // 'sent' or 'received'
      status,
      needId,
      availabilityId,
    } = req.query;
    
    // Get user's member IDs
    const memberResult = await query(
      'SELECT household_member_id FROM household_members WHERE user_id = $1 AND status = $2',
      [userId, 'active']
    );
    
    if (memberResult.rows.length === 0) {
      return res.status(403).json({
        requestId: (req as any).id,
        error: {
          code: 'FORBIDDEN',
          message: 'User has no active household membership',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const memberIds = memberResult.rows.map(r => r.household_member_id);
    
    // Build query
    let queryText = `
      SELECT or.*, 
             n.child_id, n.date, n.need_type,
             c.first_name as child_first_name, c.last_initial as child_last_initial,
             a.vehicle_id, a.seats_available,
             from_m.user_id as from_user_id,
             to_m.user_id as to_user_id
      FROM offer_requests or
      JOIN needs n ON or.need_id = n.need_id
      JOIN children c ON n.child_id = c.child_id
      JOIN availabilities a ON or.availability_id = a.availability_id
      JOIN household_members from_m ON or.from_member_id = from_m.household_member_id
      JOIN household_members to_m ON or.to_member_id = to_m.household_member_id
      WHERE 1=1
    `;
    const queryParams: any[] = [];
    let paramIndex = 1;
    
    // Filter by direction
    if (direction === 'sent') {
      queryText += ` AND or.from_member_id = ANY($${paramIndex})`;
      queryParams.push(memberIds);
      paramIndex++;
    } else if (direction === 'received') {
      queryText += ` AND or.to_member_id = ANY($${paramIndex})`;
      queryParams.push(memberIds);
      paramIndex++;
    } else {
      // Both sent and received
      queryText += ` AND (or.from_member_id = ANY($${paramIndex}) OR or.to_member_id = ANY($${paramIndex}))`;
      queryParams.push(memberIds);
      paramIndex++;
    }
    
    if (status) {
      const statuses = (status as string).split(',');
      queryText += ` AND or.status = ANY($${paramIndex})`;
      queryParams.push(statuses);
      paramIndex++;
    }
    
    if (needId) {
      queryText += ` AND or.need_id = $${paramIndex}`;
      queryParams.push(needId);
      paramIndex++;
    }
    
    if (availabilityId) {
      queryText += ` AND or.availability_id = $${paramIndex}`;
      queryParams.push(availabilityId);
      paramIndex++;
    }
    
    queryText += ' ORDER BY or.created_at DESC';
    
    const result = await query(queryText, queryParams);
    
    const offerRequests = result.rows.map((row: any) => ({
      id: row.offer_request_id,
      type: row.type,
      needId: row.need_id,
      availabilityId: row.availability_id,
      fromMemberId: row.from_member_id,
      toMemberId: row.to_member_id,
      message: row.message,
      status: row.status,
      rideSessionId: row.ride_session_id,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      need: {
        childId: row.child_id,
        childFirstName: row.child_first_name,
        childLastInitial: row.child_last_initial,
        date: row.date,
        needType: row.need_type,
      },
      availability: {
        vehicleId: row.vehicle_id,
        seatsAvailable: row.seats_available,
      },
    }));
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        offerRequests,
        total: offerRequests.length,
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

export default router;
