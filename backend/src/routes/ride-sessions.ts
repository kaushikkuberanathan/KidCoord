/**
 * Ride Sessions API Routes
 * Handles ride execution tracking with append-only status events
 * 
 * Key Concepts:
 * - RideSession tracks the execution of an accepted offer/request
 * - Status events are append-only (ARRIVED → PICKED_UP → DROPPED_OFF)
 * - DELAYED can be added anytime as informational event
 * - DROPPED_OFF triggers Care Credit issuance via outbox
 * - RideSession status is derived from latest event
 */

import { Router, Request, Response } from 'express';
import { query, transaction, generateId } from '@/utils/database';
import { logger } from '@/utils/logger';
import {
  validateRideSessionTransition,
  validateRideStatusEventProgression,
  deriveRideSessionStatus,
  shouldIssueCareCredit,
  RideSessionStatus,
  RideStatusEventType,
} from '@/utils/stateMachine';
import { requireIdempotency } from '@/middleware/idempotency';

const router = Router();

// ============================================================================
// TYPES
// ============================================================================

interface RideSession {
  ride_session_id: string;
  need_id: string;
  availability_id: string;
  offer_request_id: string;
  child_id: string;
  driver_member_id: string;
  date: string;
  status: RideSessionStatus;
  created_at: Date;
  updated_at: Date;
}

interface RideStatusEvent {
  ride_status_event_id: string;
  ride_session_id: string;
  event_type: RideStatusEventType;
  event_at: Date;
  recorded_by_member_id: string;
  location_lat: number | null;
  location_lng: number | null;
  notes: string | null;
  created_at: Date;
}

interface AddStatusEventRequest {
  eventType: 'ARRIVED' | 'PICKED_UP' | 'DROPPED_OFF' | 'DELAYED';
  eventAt?: string; // ISO 8601, defaults to now
  locationLat?: number;
  locationLng?: number;
  notes?: string;
}

// ============================================================================
// GET /ride-sessions/:rideSessionId - Get session with timeline
// ============================================================================

router.get('/:rideSessionId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { rideSessionId } = req.params;
    
    // Get RideSession with related data
    const sessionResult = await query(
      `SELECT rs.*,
              n.need_type, n.window_start_at as need_window_start, n.window_end_at as need_window_end,
              c.first_name as child_first_name, c.last_initial as child_last_initial,
              c.household_id as child_household_id,
              dm.user_id as driver_user_id,
              a.vehicle_id, a.window_start_at as availability_window_start, a.window_end_at as availability_window_end,
              v.label as vehicle_label, v.make, v.model, v.color,
              or.type as offer_request_type
       FROM ride_sessions rs
       JOIN needs n ON rs.need_id = n.need_id
       JOIN children c ON rs.child_id = c.child_id
       JOIN household_members dm ON rs.driver_member_id = dm.household_member_id
       JOIN availabilities a ON rs.availability_id = a.availability_id
       JOIN vehicles v ON a.vehicle_id = v.vehicle_id
       JOIN offer_requests or ON rs.offer_request_id = or.offer_request_id
       WHERE rs.ride_session_id = $1`,
      [rideSessionId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        requestId: (req as any).id,
        error: {
          code: 'NOT_FOUND',
          message: 'Ride session not found',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const session = sessionResult.rows[0];
    
    // Verify user has access (member of household or driver)
    const userMemberResult = await query(
      `SELECT household_member_id FROM household_members 
       WHERE user_id = $1 
       AND (household_id = $2 OR household_member_id = $3)
       AND status = $4`,
      [userId, session.child_household_id, session.driver_member_id, 'active']
    );
    
    if (userMemberResult.rows.length === 0) {
      return res.status(403).json({
        requestId: (req as any).id,
        error: {
          code: 'FORBIDDEN',
          message: 'User does not have access to this ride session',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Get status events timeline
    const eventsResult = await query<RideStatusEvent>(
      `SELECT * FROM ride_status_events 
       WHERE ride_session_id = $1 
       ORDER BY event_at ASC, created_at ASC`,
      [rideSessionId]
    );
    
    const timeline = eventsResult.rows.map(event => ({
      id: event.ride_status_event_id,
      eventType: event.event_type,
      eventAt: event.event_at,
      recordedByMemberId: event.recorded_by_member_id,
      location: event.location_lat && event.location_lng ? {
        lat: event.location_lat,
        lng: event.location_lng,
      } : null,
      notes: event.notes,
      createdAt: event.created_at,
    }));
    
    // Get participants
    const participantsResult = await query(
      `SELECT rp.*, c.first_name, c.last_initial
       FROM ride_participants rp
       JOIN children c ON rp.child_id = c.child_id
       WHERE rp.ride_session_id = $1`,
      [rideSessionId]
    );
    
    const participants = participantsResult.rows.map(p => ({
      id: p.ride_participant_id,
      childId: p.child_id,
      childFirstName: p.first_name,
      childLastInitial: p.last_initial,
      role: p.role,
    }));
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        rideSession: {
          id: session.ride_session_id,
          needId: session.need_id,
          availabilityId: session.availability_id,
          offerRequestId: session.offer_request_id,
          offerRequestType: session.offer_request_type,
          child: {
            id: session.child_id,
            firstName: session.child_first_name,
            lastInitial: session.child_last_initial,
          },
          driver: {
            memberId: session.driver_member_id,
            userId: session.driver_user_id,
          },
          vehicle: {
            id: session.vehicle_id,
            label: session.vehicle_label,
            make: session.make,
            model: session.model,
            color: session.color,
          },
          date: session.date,
          needWindow: {
            start: session.need_window_start,
            end: session.need_window_end,
          },
          availabilityWindow: {
            start: session.availability_window_start,
            end: session.availability_window_end,
          },
          status: session.status,
          participants,
          timeline,
          createdAt: session.created_at,
          updatedAt: session.updated_at,
        },
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

// ============================================================================
// POST /ride-sessions/:rideSessionId/status - Add status event
// ============================================================================

router.post('/:rideSessionId/status', requireIdempotency, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { rideSessionId } = req.params;
    const body: AddStatusEventRequest = req.body;
    
    // Validation
    if (!body.eventType || !['ARRIVED', 'PICKED_UP', 'DROPPED_OFF', 'DELAYED'].includes(body.eventType)) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Event type must be ARRIVED, PICKED_UP, DROPPED_OFF, or DELAYED',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Validate location if provided
    if ((body.locationLat && !body.locationLng) || (!body.locationLat && body.locationLng)) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Both locationLat and locationLng must be provided together',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Use transaction for atomicity
    const result = await transaction(async (client) => {
      // Get RideSession with lock
      const sessionResult = await client.query(
        `SELECT rs.*, c.household_id, n.need_type
         FROM ride_sessions rs
         JOIN children c ON rs.child_id = c.child_id
         JOIN needs n ON rs.need_id = n.need_id
         WHERE rs.ride_session_id = $1
         FOR UPDATE`,
        [rideSessionId]
      );
      
      if (sessionResult.rows.length === 0) {
        throw new Error('NOT_FOUND');
      }
      
      const session = sessionResult.rows[0];
      
      // Verify user has permission (driver or household member)
      const userMemberResult = await client.query(
        `SELECT household_member_id FROM household_members 
         WHERE user_id = $1 
         AND (household_id = $2 OR household_member_id = $3)
         AND status = $4`,
        [userId, session.household_id, session.driver_member_id, 'active']
      );
      
      if (userMemberResult.rows.length === 0) {
        throw new Error('FORBIDDEN');
      }
      
      const currentMemberId = userMemberResult.rows[0].household_member_id;
      
      // Get existing events to validate progression
      const eventsResult = await client.query(
        `SELECT event_type, event_at FROM ride_status_events 
         WHERE ride_session_id = $1 
         ORDER BY event_at ASC, created_at ASC`,
        [rideSessionId]
      );
      
      const existingEvents = eventsResult.rows;
      
      // Get last event (excluding DELAYED)
      const lastProgressEvent = existingEvents
        .filter((e: any) => e.event_type !== RideStatusEventType.DELAYED)
        .pop();
      
      const lastEventType = lastProgressEvent?.event_type || null;
      
      // Validate event progression
      try {
        validateRideStatusEventProgression(
          lastEventType,
          body.eventType as RideStatusEventType
        );
      } catch (error: any) {
        throw new Error(`INVALID_PROGRESSION:${error.message}`);
      }
      
      // Check if session is in valid status
      if (session.status === RideSessionStatus.COMPLETED) {
        throw new Error('SESSION_ALREADY_COMPLETED');
      }
      
      if (session.status === RideSessionStatus.CANCELLED) {
        throw new Error('SESSION_CANCELLED');
      }
      
      // Create status event
      const eventAt = body.eventAt ? new Date(body.eventAt) : new Date();
      const eventId = generateId('ride_status_event');
      
      const insertResult = await client.query<RideStatusEvent>(
        `INSERT INTO ride_status_events (
          ride_status_event_id, ride_session_id, event_type, event_at,
          recorded_by_member_id, location_lat, location_lng, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          eventId,
          rideSessionId,
          body.eventType,
          eventAt,
          currentMemberId,
          body.locationLat || null,
          body.locationLng || null,
          body.notes || null,
        ]
      );
      
      const statusEvent = insertResult.rows[0];
      
      // Derive new RideSession status
      const allEvents = [...existingEvents, statusEvent].map((e: any) => e.event_type);
      const newSessionStatus = deriveRideSessionStatus(allEvents);
      
      // Validate session status transition
      try {
        validateRideSessionTransition(
          session.status as RideSessionStatus,
          newSessionStatus
        );
      } catch (error: any) {
        throw new Error(`INVALID_SESSION_TRANSITION:${error.message}`);
      }
      
      // Update RideSession status
      await client.query(
        'UPDATE ride_sessions SET status = $1, updated_at = NOW() WHERE ride_session_id = $2',
        [newSessionStatus, rideSessionId]
      );
      
      // Create audit event
      await client.query(
        `INSERT INTO audit_events (
          audit_event_id, event_type, actor_user_id, actor_member_id,
          household_id, entity_type, entity_id, event_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
        [
          generateId('audit'),
          `RIDE_STATUS_${body.eventType}`,
          userId,
          currentMemberId,
          session.household_id,
          'RIDE_SESSION',
          rideSessionId,
          {
            eventType: body.eventType,
            eventAt: eventAt.toISOString(),
            notes: body.notes,
          },
        ]
      );
      
      // If DROPPED_OFF, issue Care Credit via outbox
      if (body.eventType === RideStatusEventType.DROPPED_OFF) {
        const shouldIssue = shouldIssueCareCredit(newSessionStatus);
        
        if (shouldIssue) {
          // Create outbox event for Care Credit issuance
          await client.query(
            `INSERT INTO outbox_events (
              outbox_event_id, event_type, entity_type, entity_id,
              recipient_member_id, event_at, status, payload
            ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)`,
            [
              generateId('outbox'),
              'ISSUE_CARE_CREDIT',
              'RIDE_SESSION',
              rideSessionId,
              session.driver_member_id,
              'pending',
              {
                rideSessionId,
                driverMemberId: session.driver_member_id,
                childId: session.child_id,
                needType: session.need_type,
                date: session.date,
              },
            ]
          );
          
          logger.info('Care Credit issuance queued', {
            rideSessionId,
            driverMemberId: session.driver_member_id,
          });
        }
      }
      
      return {
        statusEvent,
        newSessionStatus,
        careCreditQueued: body.eventType === RideStatusEventType.DROPPED_OFF,
      };
    });
    
    logger.info('Ride status event added', {
      rideSessionId,
      eventType: body.eventType,
      newStatus: result.newSessionStatus,
      userId,
    });
    
    res.status(201).json({
      requestId: (req as any).id,
      data: {
        statusEvent: {
          id: result.statusEvent.ride_status_event_id,
          eventType: result.statusEvent.event_type,
          eventAt: result.statusEvent.event_at,
          recordedByMemberId: result.statusEvent.recorded_by_member_id,
          location: result.statusEvent.location_lat && result.statusEvent.location_lng ? {
            lat: result.statusEvent.location_lat,
            lng: result.statusEvent.location_lng,
          } : null,
          notes: result.statusEvent.notes,
        },
        rideSessionStatus: result.newSessionStatus,
        careCreditQueued: result.careCreditQueued,
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    // Handle custom errors
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({
        requestId: (req as any).id,
        error: {
          code: 'NOT_FOUND',
          message: 'Ride session not found',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    if (error.message === 'FORBIDDEN') {
      return res.status(403).json({
        requestId: (req as any).id,
        error: {
          code: 'FORBIDDEN',
          message: 'User does not have permission to update this ride session',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    if (error.message.startsWith('INVALID_PROGRESSION:')) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'INVALID_PROGRESSION',
          message: error.message.split(':')[1],
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    if (error.message.startsWith('INVALID_SESSION_TRANSITION:')) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'INVALID_SESSION_TRANSITION',
          message: error.message.split(':')[1],
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    if (error.message === 'SESSION_ALREADY_COMPLETED') {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'SESSION_ALREADY_COMPLETED',
          message: 'Cannot add events to completed ride session',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    if (error.message === 'SESSION_CANCELLED') {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'SESSION_CANCELLED',
          message: 'Cannot add events to cancelled ride session',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    throw error;
  }
});

// ============================================================================
// GET /ride-sessions - Query ride sessions
// ============================================================================

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const {
      householdId,
      childId,
      driverMemberId,
      date,
      dateFrom,
      dateTo,
      status,
      needType,
    } = req.query;
    
    // Get user's member IDs and household IDs
    const userMemberResult = await query(
      `SELECT household_member_id, household_id FROM household_members 
       WHERE user_id = $1 AND status = $2`,
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
    
    const userMemberIds = userMemberResult.rows.map((r: any) => r.household_member_id);
    const userHouseholdIds = userMemberResult.rows.map((r: any) => r.household_id);
    
    // Build query
    let queryText = `
      SELECT rs.*,
             c.first_name as child_first_name, c.last_initial as child_last_initial, c.household_id,
             n.need_type, n.window_start_at as need_window_start, n.window_end_at as need_window_end,
             a.vehicle_id, a.window_start_at as availability_window_start,
             v.label as vehicle_label, v.make, v.model,
             or.type as offer_request_type,
             (SELECT COUNT(*) FROM ride_status_events WHERE ride_session_id = rs.ride_session_id) as event_count
      FROM ride_sessions rs
      JOIN children c ON rs.child_id = c.child_id
      JOIN needs n ON rs.need_id = n.need_id
      JOIN availabilities a ON rs.availability_id = a.availability_id
      JOIN vehicles v ON a.vehicle_id = v.vehicle_id
      JOIN offer_requests or ON rs.offer_request_id = or.offer_request_id
      WHERE (c.household_id = ANY($1) OR rs.driver_member_id = ANY($2))
    `;
    const queryParams: any[] = [userHouseholdIds, userMemberIds];
    let paramIndex = 3;
    
    if (householdId) {
      queryText += ` AND c.household_id = $${paramIndex}`;
      queryParams.push(householdId);
      paramIndex++;
    }
    
    if (childId) {
      queryText += ` AND rs.child_id = $${paramIndex}`;
      queryParams.push(childId);
      paramIndex++;
    }
    
    if (driverMemberId) {
      queryText += ` AND rs.driver_member_id = $${paramIndex}`;
      queryParams.push(driverMemberId);
      paramIndex++;
    }
    
    if (date) {
      queryText += ` AND rs.date = $${paramIndex}`;
      queryParams.push(date);
      paramIndex++;
    }
    
    if (dateFrom) {
      queryText += ` AND rs.date >= $${paramIndex}`;
      queryParams.push(dateFrom);
      paramIndex++;
    }
    
    if (dateTo) {
      queryText += ` AND rs.date <= $${paramIndex}`;
      queryParams.push(dateTo);
      paramIndex++;
    }
    
    if (status) {
      const statuses = (status as string).split(',');
      queryText += ` AND rs.status = ANY($${paramIndex})`;
      queryParams.push(statuses);
      paramIndex++;
    }
    
    if (needType) {
      queryText += ` AND n.need_type = $${paramIndex}`;
      queryParams.push(needType);
      paramIndex++;
    }
    
    queryText += ' ORDER BY rs.date DESC, rs.created_at DESC';
    
    const result = await query(queryText, queryParams);
    
    const rideSessions = result.rows.map((row: any) => ({
      id: row.ride_session_id,
      needId: row.need_id,
      availabilityId: row.availability_id,
      offerRequestId: row.offer_request_id,
      offerRequestType: row.offer_request_type,
      child: {
        id: row.child_id,
        firstName: row.child_first_name,
        lastInitial: row.child_last_initial,
        householdId: row.household_id,
      },
      driver: {
        memberId: row.driver_member_id,
      },
      vehicle: {
        id: row.vehicle_id,
        label: row.vehicle_label,
        make: row.make,
        model: row.model,
      },
      date: row.date,
      needType: row.need_type,
      needWindow: {
        start: row.need_window_start,
        end: row.need_window_end,
      },
      availabilityWindow: {
        start: row.availability_window_start,
      },
      status: row.status,
      eventCount: parseInt(row.event_count, 10),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        rideSessions,
        total: rideSessions.length,
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

export default router;
