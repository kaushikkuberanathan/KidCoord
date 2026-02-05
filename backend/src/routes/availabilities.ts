/**
 * Availabilities API Routes
 * Handles driver availability creation, clearing, and querying
 */

import { Router, Request, Response } from 'express';
import { query, transaction, generateId } from '@/utils/database';
import { logger } from '@/utils/logger';
import {
  validateAvailabilityTransition,
  AvailabilityStatus,
  StateMachine,
} from '@/utils/stateMachine';
import { requireIdempotency } from '@/middleware/idempotency';

const router = Router();

// ============================================================================
// TYPES
// ============================================================================

interface CreateAvailabilityRequest {
  vehicleId: string;
  date: string; // YYYY-MM-DD
  windowStartAt: string; // ISO 8601
  windowEndAt: string; // ISO 8601
  seatCapacity: number;
  preferenceSchoolId?: string;
  preferenceRouteId?: string;
  preferenceStopId?: string;
}

interface Availability {
  availability_id: string;
  household_member_id: string;
  vehicle_id: string;
  date: string;
  window_start_at: Date;
  window_end_at: Date;
  seat_capacity_at_time: number;
  seats_available: number;
  preference_school_id: string | null;
  preference_route_id: string | null;
  preference_stop_id: string | null;
  status: AvailabilityStatus;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// POST /availability - Create availability
// ============================================================================

router.post('/', requireIdempotency, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id; // From auth middleware
    const body: CreateAvailabilityRequest = req.body;
    
    // Validation
    if (!body.vehicleId || !body.date || !body.windowStartAt || !body.windowEndAt || !body.seatCapacity) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields',
          details: {
            required: ['vehicleId', 'date', 'windowStartAt', 'windowEndAt', 'seatCapacity'],
          },
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Validate seat capacity
    if (body.seatCapacity < 1 || body.seatCapacity > 20) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Seat capacity must be between 1 and 20',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Validate time window
    const windowStart = new Date(body.windowStartAt);
    const windowEnd = new Date(body.windowEndAt);
    
    if (windowEnd <= windowStart) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Window end must be after window start',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Get vehicle and verify ownership
    const vehicleResult = await query<{ household_id: string; seat_capacity: number }>(
      'SELECT household_id, seat_capacity FROM vehicles WHERE vehicle_id = $1 AND status = $2',
      [body.vehicleId, 'active']
    );
    
    if (vehicleResult.rows.length === 0) {
      return res.status(404).json({
        requestId: (req as any).id,
        error: {
          code: 'NOT_FOUND',
          message: 'Vehicle not found or inactive',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const vehicle = vehicleResult.rows[0];
    const householdId = vehicle.household_id;
    
    // Verify seat capacity doesn't exceed vehicle capacity
    if (body.seatCapacity > vehicle.seat_capacity) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Seat capacity (${body.seatCapacity}) exceeds vehicle capacity (${vehicle.seat_capacity})`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Get member_id for current user in this household
    const memberResult = await query<{ household_member_id: string; roles: string[] }>(
      'SELECT household_member_id, roles FROM household_members WHERE household_id = $1 AND user_id = $2 AND status = $3',
      [householdId, userId, 'active']
    );
    
    if (memberResult.rows.length === 0) {
      return res.status(403).json({
        requestId: (req as any).id,
        error: {
          code: 'FORBIDDEN',
          message: 'User is not a member of this household',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const member = memberResult.rows[0];
    const memberId = member.household_member_id;
    
    // Check if user has DRIVER role
    if (!member.roles.includes('DRIVER')) {
      return res.status(403).json({
        requestId: (req as any).id,
        error: {
          code: 'FORBIDDEN',
          message: 'User does not have DRIVER role',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Verify driver is authorized for this vehicle
    const driverAuthResult = await query(
      'SELECT 1 FROM vehicle_drivers WHERE vehicle_id = $1 AND household_member_id = $2',
      [body.vehicleId, memberId]
    );
    
    if (driverAuthResult.rows.length === 0) {
      return res.status(403).json({
        requestId: (req as any).id,
        error: {
          code: 'FORBIDDEN',
          message: 'User is not authorized to drive this vehicle',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Validate preference references if provided
    if (body.preferenceSchoolId) {
      const schoolCheck = await query(
        'SELECT 1 FROM schools WHERE school_id = $1 AND status = $2',
        [body.preferenceSchoolId, 'active']
      );
      if (schoolCheck.rows.length === 0) {
        return res.status(400).json({
          requestId: (req as any).id,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid preference school ID',
          },
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    if (body.preferenceRouteId) {
      const routeCheck = await query(
        'SELECT 1 FROM routes WHERE route_id = $1 AND status = $2',
        [body.preferenceRouteId, 'active']
      );
      if (routeCheck.rows.length === 0) {
        return res.status(400).json({
          requestId: (req as any).id,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid preference route ID',
          },
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    if (body.preferenceStopId) {
      const stopCheck = await query(
        'SELECT 1 FROM stops WHERE stop_id = $1 AND status = $2',
        [body.preferenceStopId, 'active']
      );
      if (stopCheck.rows.length === 0) {
        return res.status(400).json({
          requestId: (req as any).id,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid preference stop ID',
          },
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    // Create availability
    const availabilityId = generateId('availability');
    
    // Insert availability
    // Note: PostgreSQL exclusion constraint will prevent overlapping ACTIVE windows
    const insertResult = await query<Availability>(
      `INSERT INTO availabilities (
        availability_id, household_member_id, vehicle_id, date,
        window_start_at, window_end_at, seat_capacity_at_time, seats_available,
        preference_school_id, preference_route_id, preference_stop_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        availabilityId,
        memberId,
        body.vehicleId,
        body.date,
        body.windowStartAt,
        body.windowEndAt,
        body.seatCapacity,
        body.seatCapacity, // Initially all seats available
        body.preferenceSchoolId || null,
        body.preferenceRouteId || null,
        body.preferenceStopId || null,
        AvailabilityStatus.ACTIVE,
      ]
    );
    
    const availability = insertResult.rows[0];
    
    // Create audit event
    await query(
      `INSERT INTO audit_events (
        audit_event_id, event_type, actor_user_id, actor_member_id,
        household_id, entity_type, entity_id, event_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
      [
        generateId('audit'),
        'AVAILABILITY_CREATED',
        userId,
        memberId,
        householdId,
        'AVAILABILITY',
        availabilityId,
        {
          vehicleId: body.vehicleId,
          date: body.date,
          seatCapacity: body.seatCapacity,
        },
      ]
    );
    
    logger.info('Availability created', {
      availabilityId,
      vehicleId: body.vehicleId,
      date: body.date,
      userId,
    });
    
    // Return response
    res.status(201).json({
      requestId: (req as any).id,
      data: {
        availability: {
          id: availability.availability_id,
          householdMemberId: availability.household_member_id,
          vehicleId: availability.vehicle_id,
          date: availability.date,
          windowStartAt: availability.window_start_at,
          windowEndAt: availability.window_end_at,
          seatCapacityAtTime: availability.seat_capacity_at_time,
          seatsAvailable: availability.seats_available,
          preferenceSchoolId: availability.preference_school_id,
          preferenceRouteId: availability.preference_route_id,
          preferenceStopId: availability.preference_stop_id,
          status: availability.status,
          createdAt: availability.created_at,
          updatedAt: availability.updated_at,
        },
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    // Handle PostgreSQL exclusion constraint violation (overlapping windows)
    if (error.code === '23P01') {
      return res.status(409).json({
        requestId: (req as any).id,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'An overlapping active availability already exists for this driver on this date',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    throw error;
  }
});

// ============================================================================
// PATCH /availability/:availabilityId/clear - Clear availability
// ============================================================================

router.patch('/:availabilityId/clear', requireIdempotency, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { availabilityId } = req.params;
    
    // Get current availability
    const availabilityResult = await query<Availability>(
      'SELECT * FROM availabilities WHERE availability_id = $1',
      [availabilityId]
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
    
    // Validate state transition
    try {
      validateAvailabilityTransition(
        availability.status as AvailabilityStatus,
        AvailabilityStatus.CLEARED
      );
    } catch (error: any) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: error.toJSON(),
        timestamp: new Date().toISOString(),
      });
    }
    
    // Verify user has permission (member of household)
    const vehicleResult = await query<{ household_id: string }>(
      'SELECT household_id FROM vehicles WHERE vehicle_id = $1',
      [availability.vehicle_id]
    );
    
    if (vehicleResult.rows.length === 0) {
      return res.status(500).json({
        requestId: (req as any).id,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Vehicle not found for availability',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const householdId = vehicleResult.rows[0].household_id;
    
    const memberResult = await query(
      'SELECT 1 FROM household_members WHERE household_id = $1 AND user_id = $2 AND status = $3',
      [householdId, userId, 'active']
    );
    
    if (memberResult.rows.length === 0) {
      return res.status(403).json({
        requestId: (req as any).id,
        error: {
          code: 'FORBIDDEN',
          message: 'User is not authorized to clear this availability',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Update availability status
    const updateResult = await query<Availability>(
      'UPDATE availabilities SET status = $1, updated_at = NOW() WHERE availability_id = $2 RETURNING *',
      [AvailabilityStatus.CLEARED, availabilityId]
    );
    
    const updatedAvailability = updateResult.rows[0];
    
    // Create audit event
    await query(
      `INSERT INTO audit_events (
        audit_event_id, event_type, actor_user_id, household_id,
        entity_type, entity_id, event_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        generateId('audit'),
        'AVAILABILITY_CLEARED',
        userId,
        householdId,
        'AVAILABILITY',
        availabilityId,
      ]
    );
    
    logger.info('Availability cleared', { availabilityId, userId });
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        availability: {
          id: updatedAvailability.availability_id,
          status: updatedAvailability.status,
          updatedAt: updatedAvailability.updated_at,
        },
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

// ============================================================================
// GET /availability - Query availabilities
// ============================================================================

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const {
      householdMemberId,
      vehicleId,
      date,
      status,
      dateFrom,
      dateTo,
    } = req.query;
    
    // Build query
    let queryText = `
      SELECT a.*, v.label as vehicle_label, v.seat_capacity as vehicle_seat_capacity
      FROM availabilities a
      JOIN vehicles v ON a.vehicle_id = v.vehicle_id
      WHERE 1=1
    `;
    const queryParams: any[] = [];
    let paramIndex = 1;
    
    if (householdMemberId) {
      queryText += ` AND a.household_member_id = $${paramIndex}`;
      queryParams.push(householdMemberId);
      paramIndex++;
    }
    
    if (vehicleId) {
      queryText += ` AND a.vehicle_id = $${paramIndex}`;
      queryParams.push(vehicleId);
      paramIndex++;
    }
    
    if (date) {
      queryText += ` AND a.date = $${paramIndex}`;
      queryParams.push(date);
      paramIndex++;
    }
    
    if (status) {
      const statuses = (status as string).split(',');
      queryText += ` AND a.status = ANY($${paramIndex})`;
      queryParams.push(statuses);
      paramIndex++;
    }
    
    if (dateFrom) {
      queryText += ` AND a.date >= $${paramIndex}`;
      queryParams.push(dateFrom);
      paramIndex++;
    }
    
    if (dateTo) {
      queryText += ` AND a.date <= $${paramIndex}`;
      queryParams.push(dateTo);
      paramIndex++;
    }
    
    queryText += ' ORDER BY a.date ASC, a.window_start_at ASC';
    
    const result = await query(queryText, queryParams);
    
    const availabilities = result.rows.map((row: any) => ({
      id: row.availability_id,
      householdMemberId: row.household_member_id,
      vehicleId: row.vehicle_id,
      vehicle: {
        label: row.vehicle_label,
        seatCapacity: row.vehicle_seat_capacity,
      },
      date: row.date,
      windowStartAt: row.window_start_at,
      windowEndAt: row.window_end_at,
      seatCapacityAtTime: row.seat_capacity_at_time,
      seatsAvailable: row.seats_available,
      preferenceSchoolId: row.preference_school_id,
      preferenceRouteId: row.preference_route_id,
      preferenceStopId: row.preference_stop_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        availabilities,
        total: availabilities.length,
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

export default router;
