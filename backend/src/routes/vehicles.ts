/**
 * Vehicles API Routes
 * Manage household vehicles
 */

import { Router, Request, Response } from 'express';
import { query, generateId } from '@/utils/database';
import { logger } from '@/utils/logger';
import { authenticate } from '@/middleware/auth';
import { requireIdempotency } from '@/middleware/idempotency';

const router = Router();

// ============================================================================
// TYPES
// ============================================================================

interface CreateVehicleRequest {
  householdId: string;
  label: string;
  make: string;
  model: string;
  year: number;
  color: string;
  seatCapacity: number;
  licensePlate?: string;
}

interface UpdateVehicleRequest {
  label?: string;
  color?: string;
  seatCapacity?: number;
  licensePlate?: string;
}

interface AddDriverRequest {
  memberId: string;
}

// ============================================================================
// GET /vehicles - List vehicles (filtered by household)
// ============================================================================

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { householdId } = req.query;
    
    // Build query
    let queryText = `
      SELECT v.*, h.name as household_name,
             (SELECT COUNT(*) FROM vehicle_drivers WHERE vehicle_id = v.vehicle_id) as driver_count
      FROM vehicles v
      JOIN households h ON v.household_id = h.household_id
      JOIN household_members hm ON h.household_id = hm.household_id
      WHERE hm.user_id = $1 AND hm.status = $2 AND v.status = $3
    `;
    const params: any[] = [userId, 'active', 'active'];
    
    if (householdId) {
      queryText += ' AND v.household_id = $4';
      params.push(householdId);
    }
    
    queryText += ' ORDER BY v.created_at ASC';
    
    const result = await query(queryText, params);
    
    const vehicles = result.rows.map(row => ({
      id: row.vehicle_id,
      householdId: row.household_id,
      householdName: row.household_name,
      label: row.label,
      make: row.make,
      model: row.model,
      year: row.year,
      color: row.color,
      licensePlate: row.license_plate,
      seatCapacity: row.seat_capacity,
      driverCount: parseInt(row.driver_count, 10),
      status: row.status,
      createdAt: row.created_at,
    }));
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        vehicles,
        total: vehicles.length,
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

// ============================================================================
// POST /vehicles - Create vehicle
// ============================================================================

router.post('/', authenticate, requireIdempotency, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const body: CreateVehicleRequest = req.body;
    
    // Validation
    if (!body.householdId || !body.label || !body.make || !body.model || 
        !body.year || !body.color || !body.seatCapacity) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'householdId, label, make, model, year, color, and seatCapacity are required',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Validate year
    const currentYear = new Date().getFullYear();
    if (body.year < 1990 || body.year > currentYear + 1) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'INVALID_YEAR',
          message: `Year must be between 1990 and ${currentYear + 1}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Validate seat capacity
    if (body.seatCapacity < 1 || body.seatCapacity > 20) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'INVALID_CAPACITY',
          message: 'Seat capacity must be between 1 and 20',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Verify user is a member of household
    const memberResult = await query(
      `SELECT household_member_id, roles FROM household_members 
       WHERE household_id = $1 AND user_id = $2 AND status = $3`,
      [body.householdId, userId, 'active']
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
    
    const memberId = memberResult.rows[0].household_member_id;
    const memberRoles = memberResult.rows[0].roles;
    
    // Create vehicle
    const vehicleId = generateId('vehicle');
    const vehicleResult = await query(
      `INSERT INTO vehicles (
        vehicle_id, household_id, label, make, model, year, color, 
        license_plate, seat_capacity, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *`,
      [
        vehicleId,
        body.householdId,
        body.label.trim(),
        body.make.trim(),
        body.model.trim(),
        body.year,
        body.color.trim(),
        body.licensePlate?.trim() || null,
        body.seatCapacity,
        'active',
      ]
    );
    
    const vehicle = vehicleResult.rows[0];
    
    // Automatically add creator as driver if they have DRIVER role
    if (memberRoles.includes('DRIVER')) {
      const driverId = generateId('vehicle_driver');
      await query(
        `INSERT INTO vehicle_drivers (vehicle_driver_id, vehicle_id, household_member_id, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [driverId, vehicleId, memberId]
      );
    }
    
    // Create audit event
    await query(
      `INSERT INTO audit_events (
        audit_event_id, event_type, actor_user_id, actor_member_id,
        household_id, entity_type, entity_id, event_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
      [
        generateId('audit'),
        'VEHICLE_CREATED',
        userId,
        memberId,
        body.householdId,
        'VEHICLE',
        vehicleId,
        {
          label: body.label,
          make: body.make,
          model: body.model,
        },
      ]
    );
    
    logger.info('Vehicle created', { vehicleId, householdId: body.householdId });
    
    res.status(201).json({
      requestId: (req as any).id,
      data: {
        vehicle: {
          id: vehicle.vehicle_id,
          householdId: vehicle.household_id,
          label: vehicle.label,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          color: vehicle.color,
          licensePlate: vehicle.license_plate,
          seatCapacity: vehicle.seat_capacity,
          status: vehicle.status,
          createdAt: vehicle.created_at,
        },
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

// ============================================================================
// GET /vehicles/:vehicleId - Get vehicle details
// ============================================================================

router.get('/:vehicleId', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { vehicleId } = req.params;
    
    // Get vehicle
    const vehicleResult = await query(
      'SELECT * FROM vehicles WHERE vehicle_id = $1',
      [vehicleId]
    );
    
    if (vehicleResult.rows.length === 0) {
      return res.status(404).json({
        requestId: (req as any).id,
        error: {
          code: 'NOT_FOUND',
          message: 'Vehicle not found',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const vehicle = vehicleResult.rows[0];
    
    // Verify user is a member of household
    const memberCheck = await query(
      `SELECT 1 FROM household_members 
       WHERE household_id = $1 AND user_id = $2 AND status = $3`,
      [vehicle.household_id, userId, 'active']
    );
    
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        requestId: (req as any).id,
        error: {
          code: 'FORBIDDEN',
          message: 'User does not have access to this vehicle',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Get authorized drivers
    const driversResult = await query(
      `SELECT vd.vehicle_driver_id, vd.household_member_id, hm.user_id, u.phone
       FROM vehicle_drivers vd
       JOIN household_members hm ON vd.household_member_id = hm.household_member_id
       JOIN users u ON hm.user_id = u.user_id
       WHERE vd.vehicle_id = $1`,
      [vehicleId]
    );
    
    const drivers = driversResult.rows.map(d => ({
      memberId: d.household_member_id,
      userId: d.user_id,
      phone: d.phone,
    }));
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        vehicle: {
          id: vehicle.vehicle_id,
          householdId: vehicle.household_id,
          label: vehicle.label,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          color: vehicle.color,
          licensePlate: vehicle.license_plate,
          seatCapacity: vehicle.seat_capacity,
          status: vehicle.status,
          drivers,
          createdAt: vehicle.created_at,
        },
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

// ============================================================================
// PATCH /vehicles/:vehicleId - Update vehicle
// ============================================================================

router.patch('/:vehicleId', authenticate, requireIdempotency, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { vehicleId } = req.params;
    const body: UpdateVehicleRequest = req.body;
    
    // Get vehicle
    const vehicleResult = await query(
      'SELECT * FROM vehicles WHERE vehicle_id = $1',
      [vehicleId]
    );
    
    if (vehicleResult.rows.length === 0) {
      return res.status(404).json({
        requestId: (req as any).id,
        error: {
          code: 'NOT_FOUND',
          message: 'Vehicle not found',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const vehicle = vehicleResult.rows[0];
    
    // Verify user is a member of household
    const memberCheck = await query(
      `SELECT 1 FROM household_members 
       WHERE household_id = $1 AND user_id = $2 AND status = $3`,
      [vehicle.household_id, userId, 'active']
    );
    
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        requestId: (req as any).id,
        error: {
          code: 'FORBIDDEN',
          message: 'User does not have permission to update this vehicle',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (body.label) {
      updates.push(`label = $${paramIndex}`);
      values.push(body.label.trim());
      paramIndex++;
    }
    
    if (body.color) {
      updates.push(`color = $${paramIndex}`);
      values.push(body.color.trim());
      paramIndex++;
    }
    
    if (body.seatCapacity) {
      if (body.seatCapacity < 1 || body.seatCapacity > 20) {
        return res.status(400).json({
          requestId: (req as any).id,
          error: {
            code: 'INVALID_CAPACITY',
            message: 'Seat capacity must be between 1 and 20',
          },
          timestamp: new Date().toISOString(),
        });
      }
      updates.push(`seat_capacity = $${paramIndex}`);
      values.push(body.seatCapacity);
      paramIndex++;
    }
    
    if (body.licensePlate !== undefined) {
      updates.push(`license_plate = $${paramIndex}`);
      values.push(body.licensePlate?.trim() || null);
      paramIndex++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'NO_UPDATES',
          message: 'No valid fields to update',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(vehicleId);
    
    const updateQuery = `
      UPDATE vehicles 
      SET ${updates.join(', ')}
      WHERE vehicle_id = $${paramIndex}
      RETURNING *
    `;
    
    const updateResult = await query(updateQuery, values);
    const updatedVehicle = updateResult.rows[0];
    
    logger.info('Vehicle updated', { vehicleId });
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        vehicle: {
          id: updatedVehicle.vehicle_id,
          label: updatedVehicle.label,
          color: updatedVehicle.color,
          seatCapacity: updatedVehicle.seat_capacity,
          licensePlate: updatedVehicle.license_plate,
          updatedAt: updatedVehicle.updated_at,
        },
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

// ============================================================================
// POST /vehicles/:vehicleId/drivers - Add authorized driver
// ============================================================================

router.post('/:vehicleId/drivers', authenticate, requireIdempotency, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { vehicleId } = req.params;
    const body: AddDriverRequest = req.body;
    
    if (!body.memberId) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'memberId is required',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Get vehicle
    const vehicleResult = await query(
      'SELECT * FROM vehicles WHERE vehicle_id = $1',
      [vehicleId]
    );
    
    if (vehicleResult.rows.length === 0) {
      return res.status(404).json({
        requestId: (req as any).id,
        error: {
          code: 'NOT_FOUND',
          message: 'Vehicle not found',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const vehicle = vehicleResult.rows[0];
    
    // Verify user is a member of household (and preferably ADMIN)
    const memberCheck = await query(
      `SELECT 1 FROM household_members 
       WHERE household_id = $1 AND user_id = $2 AND status = $3`,
      [vehicle.household_id, userId, 'active']
    );
    
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        requestId: (req as any).id,
        error: {
          code: 'FORBIDDEN',
          message: 'User does not have permission',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Verify target member exists and has DRIVER role
    const targetMemberResult = await query(
      `SELECT * FROM household_members 
       WHERE household_member_id = $1 AND household_id = $2 AND status = $3`,
      [body.memberId, vehicle.household_id, 'active']
    );
    
    if (targetMemberResult.rows.length === 0) {
      return res.status(404).json({
        requestId: (req as any).id,
        error: {
          code: 'MEMBER_NOT_FOUND',
          message: 'Member not found in household',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const targetMember = targetMemberResult.rows[0];
    
    if (!targetMember.roles.includes('DRIVER')) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'NOT_A_DRIVER',
          message: 'Member does not have DRIVER role',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Check if already authorized
    const existingDriver = await query(
      `SELECT 1 FROM vehicle_drivers 
       WHERE vehicle_id = $1 AND household_member_id = $2`,
      [vehicleId, body.memberId]
    );
    
    if (existingDriver.rows.length > 0) {
      return res.status(409).json({
        requestId: (req as any).id,
        error: {
          code: 'ALREADY_AUTHORIZED',
          message: 'Member is already an authorized driver',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Add driver
    const driverId = generateId('vehicle_driver');
    await query(
      `INSERT INTO vehicle_drivers (vehicle_driver_id, vehicle_id, household_member_id, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [driverId, vehicleId, body.memberId]
    );
    
    logger.info('Driver added to vehicle', { vehicleId, memberId: body.memberId });
    
    res.status(201).json({
      requestId: (req as any).id,
      data: {
        message: 'Driver authorized successfully',
        vehicleId,
        memberId: body.memberId,
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

export default router;
