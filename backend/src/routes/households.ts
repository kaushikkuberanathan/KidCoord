/**
 * Households API Routes
 * Manage households and household memberships
 */

import { Router, Request, Response } from 'express';
import { query, transaction, generateId } from '@/utils/database';
import { logger } from '@/utils/logger';
import { authenticate } from '@/middleware/auth';
import { requireIdempotency } from '@/middleware/idempotency';

const router = Router();

// ============================================================================
// TYPES
// ============================================================================

interface CreateHouseholdRequest {
  name: string;
  roles?: string[]; // Roles for the creator
}

interface AddMemberRequest {
  phone: string;
  roles: string[]; // PARENT, DRIVER, ADMIN
}

interface UpdateMemberRolesRequest {
  roles: string[];
}

// ============================================================================
// GET /households - List user's households
// ============================================================================

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Get all households where user is a member
    const result = await query(
      `SELECT h.*, hm.household_member_id, hm.roles, hm.status as member_status,
              (SELECT COUNT(*) FROM household_members WHERE household_id = h.household_id AND status = 'active') as member_count,
              (SELECT COUNT(*) FROM children WHERE household_id = h.household_id AND status = 'active') as child_count,
              (SELECT COUNT(*) FROM vehicles WHERE household_id = h.household_id AND status = 'active') as vehicle_count
       FROM households h
       JOIN household_members hm ON h.household_id = hm.household_id
       WHERE hm.user_id = $1
       ORDER BY h.created_at DESC`,
      [userId]
    );
    
    const households = result.rows.map(row => ({
      id: row.household_id,
      name: row.name,
      membership: {
        id: row.household_member_id,
        roles: row.roles,
        status: row.member_status,
      },
      counts: {
        members: parseInt(row.member_count, 10),
        children: parseInt(row.child_count, 10),
        vehicles: parseInt(row.vehicle_count, 10),
      },
      createdAt: row.created_at,
    }));
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        households,
        total: households.length,
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

// ============================================================================
// POST /households - Create household
// ============================================================================

router.post('/', authenticate, requireIdempotency, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const body: CreateHouseholdRequest = req.body;
    
    // Validation
    if (!body.name || body.name.trim().length === 0) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Household name is required',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    if (body.name.length > 100) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Household name must be 100 characters or less',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Default roles for creator
    const creatorRoles = body.roles || ['PARENT', 'ADMIN'];
    
    // Validate roles
    const validRoles = ['PARENT', 'DRIVER', 'ADMIN'];
    for (const role of creatorRoles) {
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          requestId: (req as any).id,
          error: {
            code: 'INVALID_ROLE',
            message: `Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    // Create household and add creator as member in transaction
    const result = await transaction(async (client) => {
      const householdId = generateId('household');
      
      // Create household
      const householdResult = await client.query(
        `INSERT INTO households (household_id, name, created_at)
         VALUES ($1, $2, NOW())
         RETURNING *`,
        [householdId, body.name.trim()]
      );
      
      const household = householdResult.rows[0];
      
      // Add creator as member
      const memberId = generateId('household_member');
      const memberResult = await client.query(
        `INSERT INTO household_members (
          household_member_id, household_id, user_id, roles, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *`,
        [memberId, householdId, userId, creatorRoles, 'active']
      );
      
      const member = memberResult.rows[0];
      
      // Create audit event
      await client.query(
        `INSERT INTO audit_events (
          audit_event_id, event_type, actor_user_id, actor_member_id,
          household_id, entity_type, entity_id, event_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
        [
          generateId('audit'),
          'HOUSEHOLD_CREATED',
          userId,
          memberId,
          householdId,
          'HOUSEHOLD',
          householdId,
          { name: body.name },
        ]
      );
      
      return { household, member };
    });
    
    logger.info('Household created', {
      householdId: result.household.household_id,
      userId,
    });
    
    res.status(201).json({
      requestId: (req as any).id,
      data: {
        household: {
          id: result.household.household_id,
          name: result.household.name,
          createdAt: result.household.created_at,
        },
        membership: {
          id: result.member.household_member_id,
          roles: result.member.roles,
          status: result.member.status,
        },
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

// ============================================================================
// GET /households/:householdId - Get household details
// ============================================================================

router.get('/:householdId', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { householdId } = req.params;
    
    // Get household
    const householdResult = await query(
      'SELECT * FROM households WHERE household_id = $1',
      [householdId]
    );
    
    if (householdResult.rows.length === 0) {
      return res.status(404).json({
        requestId: (req as any).id,
        error: {
          code: 'NOT_FOUND',
          message: 'Household not found',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const household = householdResult.rows[0];
    
    // Verify user is a member
    const membershipResult = await query(
      `SELECT * FROM household_members 
       WHERE household_id = $1 AND user_id = $2 AND status = $3`,
      [householdId, userId, 'active']
    );
    
    if (membershipResult.rows.length === 0) {
      return res.status(403).json({
        requestId: (req as any).id,
        error: {
          code: 'FORBIDDEN',
          message: 'User is not a member of this household',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Get all members
    const membersResult = await query(
      `SELECT hm.*, u.phone
       FROM household_members hm
       JOIN users u ON hm.user_id = u.user_id
       WHERE hm.household_id = $1
       ORDER BY hm.created_at ASC`,
      [householdId]
    );
    
    const members = membersResult.rows.map(m => ({
      id: m.household_member_id,
      userId: m.user_id,
      phone: m.phone,
      roles: m.roles,
      status: m.status,
      createdAt: m.created_at,
    }));
    
    // Get children
    const childrenResult = await query(
      `SELECT * FROM children WHERE household_id = $1 ORDER BY created_at ASC`,
      [householdId]
    );
    
    const children = childrenResult.rows.map(c => ({
      id: c.child_id,
      firstName: c.first_name,
      lastInitial: c.last_initial,
      gradeLevel: c.grade_level,
      status: c.status,
    }));
    
    // Get vehicles
    const vehiclesResult = await query(
      `SELECT * FROM vehicles WHERE household_id = $1 ORDER BY created_at ASC`,
      [householdId]
    );
    
    const vehicles = vehiclesResult.rows.map(v => ({
      id: v.vehicle_id,
      label: v.label,
      make: v.make,
      model: v.model,
      year: v.year,
      color: v.color,
      seatCapacity: v.seat_capacity,
      status: v.status,
    }));
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        household: {
          id: household.household_id,
          name: household.name,
          createdAt: household.created_at,
        },
        members,
        children,
        vehicles,
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

// ============================================================================
// POST /households/:householdId/members - Add member to household
// ============================================================================

router.post('/:householdId/members', authenticate, requireIdempotency, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { householdId } = req.params;
    const body: AddMemberRequest = req.body;
    
    // Validation
    if (!body.phone || !body.roles || body.roles.length === 0) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Phone and roles are required',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Validate roles
    const validRoles = ['PARENT', 'DRIVER', 'ADMIN'];
    for (const role of body.roles) {
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          requestId: (req as any).id,
          error: {
            code: 'INVALID_ROLE',
            message: `Invalid role: ${role}`,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    // Verify household exists
    const householdResult = await query(
      'SELECT * FROM households WHERE household_id = $1',
      [householdId]
    );
    
    if (householdResult.rows.length === 0) {
      return res.status(404).json({
        requestId: (req as any).id,
        error: {
          code: 'NOT_FOUND',
          message: 'Household not found',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Verify current user is ADMIN
    const adminCheck = await query(
      `SELECT * FROM household_members 
       WHERE household_id = $1 AND user_id = $2 
       AND $3 = ANY(roles) AND status = $4`,
      [householdId, userId, 'ADMIN', 'active']
    );
    
    if (adminCheck.rows.length === 0) {
      return res.status(403).json({
        requestId: (req as any).id,
        error: {
          code: 'FORBIDDEN',
          message: 'Only household admins can add members',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Find user by phone
    const { hashSensitiveData } = await import('@/utils/database');
    const phoneHash = hashSensitiveData(body.phone);
    const userResult = await query(
      'SELECT user_id FROM users WHERE phone_hash = $1',
      [phoneHash]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        requestId: (req as any).id,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'No user found with that phone number',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const targetUserId = userResult.rows[0].user_id;
    
    // Check if already a member
    const existingMember = await query(
      `SELECT * FROM household_members 
       WHERE household_id = $1 AND user_id = $2`,
      [householdId, targetUserId]
    );
    
    if (existingMember.rows.length > 0) {
      return res.status(409).json({
        requestId: (req as any).id,
        error: {
          code: 'ALREADY_MEMBER',
          message: 'User is already a member of this household',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Add member
    const memberId = generateId('household_member');
    const memberResult = await query(
      `INSERT INTO household_members (
        household_member_id, household_id, user_id, roles, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *`,
      [memberId, householdId, targetUserId, body.roles, 'active']
    );
    
    const member = memberResult.rows[0];
    
    // Create audit event
    await query(
      `INSERT INTO audit_events (
        audit_event_id, event_type, actor_user_id,
        household_id, entity_type, entity_id, event_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)`,
      [
        generateId('audit'),
        'MEMBER_ADDED',
        userId,
        householdId,
        'HOUSEHOLD_MEMBER',
        memberId,
        { targetUserId, roles: body.roles },
      ]
    );
    
    logger.info('Member added to household', {
      householdId,
      memberId,
      targetUserId,
    });
    
    res.status(201).json({
      requestId: (req as any).id,
      data: {
        member: {
          id: member.household_member_id,
          userId: member.user_id,
          roles: member.roles,
          status: member.status,
          createdAt: member.created_at,
        },
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

// ============================================================================
// PATCH /households/:householdId/members/:memberId - Update member roles
// ============================================================================

router.patch('/:householdId/members/:memberId', authenticate, requireIdempotency, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { householdId, memberId } = req.params;
    const body: UpdateMemberRolesRequest = req.body;
    
    // Validation
    if (!body.roles || body.roles.length === 0) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Roles are required',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Validate roles
    const validRoles = ['PARENT', 'DRIVER', 'ADMIN'];
    for (const role of body.roles) {
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          requestId: (req as any).id,
          error: {
            code: 'INVALID_ROLE',
            message: `Invalid role: ${role}`,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    // Verify current user is ADMIN
    const adminCheck = await query(
      `SELECT * FROM household_members 
       WHERE household_id = $1 AND user_id = $2 
       AND $3 = ANY(roles) AND status = $4`,
      [householdId, userId, 'ADMIN', 'active']
    );
    
    if (adminCheck.rows.length === 0) {
      return res.status(403).json({
        requestId: (req as any).id,
        error: {
          code: 'FORBIDDEN',
          message: 'Only household admins can update member roles',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Update member roles
    const updateResult = await query(
      `UPDATE household_members 
       SET roles = $1, updated_at = NOW() 
       WHERE household_member_id = $2 AND household_id = $3
       RETURNING *`,
      [body.roles, memberId, householdId]
    );
    
    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        requestId: (req as any).id,
        error: {
          code: 'NOT_FOUND',
          message: 'Member not found',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const member = updateResult.rows[0];
    
    logger.info('Member roles updated', { memberId, roles: body.roles });
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        member: {
          id: member.household_member_id,
          roles: member.roles,
          updatedAt: member.updated_at,
        },
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

export default router;
