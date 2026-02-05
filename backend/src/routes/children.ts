/**
 * Children API Routes
 * Manage children within households
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

interface CreateChildRequest {
  householdId: string;
  firstName: string;
  lastInitial: string;
  gradeLevel: string; // K, 1-12
  schoolId?: string;
  routeId?: string;
}

interface UpdateChildRequest {
  firstName?: string;
  lastInitial?: string;
  gradeLevel?: string;
}

// ============================================================================
// GET /children - List children (filtered by household)
// ============================================================================

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { householdId } = req.query;
    
    // Build query
    let queryText = `
      SELECT c.*, h.name as household_name,
             csp.school_id, s.name as school_name,
             csp.route_id, r.name as route_name
      FROM children c
      JOIN households h ON c.household_id = h.household_id
      JOIN household_members hm ON h.household_id = hm.household_id
      LEFT JOIN child_school_profiles csp ON c.child_id = csp.child_id AND csp.status = 'active'
      LEFT JOIN schools s ON csp.school_id = s.school_id
      LEFT JOIN routes r ON csp.route_id = r.route_id
      WHERE hm.user_id = $1 AND hm.status = $2 AND c.status = $3
    `;
    const params: any[] = [userId, 'active', 'active'];
    
    if (householdId) {
      queryText += ' AND c.household_id = $4';
      params.push(householdId);
    }
    
    queryText += ' ORDER BY c.created_at ASC';
    
    const result = await query(queryText, params);
    
    const children = result.rows.map(row => ({
      id: row.child_id,
      householdId: row.household_id,
      householdName: row.household_name,
      firstName: row.first_name,
      lastInitial: row.last_initial,
      gradeLevel: row.grade_level,
      schoolProfile: row.school_id ? {
        schoolId: row.school_id,
        schoolName: row.school_name,
        routeId: row.route_id,
        routeName: row.route_name,
      } : null,
      status: row.status,
      createdAt: row.created_at,
    }));
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        children,
        total: children.length,
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

// ============================================================================
// POST /children - Create child
// ============================================================================

router.post('/', authenticate, requireIdempotency, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const body: CreateChildRequest = req.body;
    
    // Validation
    if (!body.householdId || !body.firstName || !body.lastInitial || !body.gradeLevel) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'householdId, firstName, lastInitial, and gradeLevel are required',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Validate first name
    if (body.firstName.length > 50) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'First name must be 50 characters or less',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Validate last initial
    if (body.lastInitial.length !== 1 || !/^[A-Z]$/i.test(body.lastInitial)) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Last initial must be a single letter',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Validate grade level
    const validGrades = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    if (!validGrades.includes(body.gradeLevel)) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'INVALID_GRADE',
          message: 'Grade level must be K or 1-12',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Verify user is a member of household
    const memberResult = await query(
      `SELECT household_member_id FROM household_members 
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
    
    // Validate school if provided
    if (body.schoolId) {
      const schoolCheck = await query(
        'SELECT 1 FROM schools WHERE school_id = $1 AND status = $2',
        [body.schoolId, 'active']
      );
      if (schoolCheck.rows.length === 0) {
        return res.status(400).json({
          requestId: (req as any).id,
          error: {
            code: 'INVALID_SCHOOL',
            message: 'Invalid school ID',
          },
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    // Create child
    const childId = generateId('child');
    const childResult = await query(
      `INSERT INTO children (
        child_id, household_id, first_name, last_initial, grade_level, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *`,
      [
        childId,
        body.householdId,
        body.firstName.trim(),
        body.lastInitial.toUpperCase(),
        body.gradeLevel,
        'active',
      ]
    );
    
    const child = childResult.rows[0];
    
    // Create school profile if school provided
    if (body.schoolId) {
      const profileId = generateId('profile');
      await query(
        `INSERT INTO child_school_profiles (
          profile_id, child_id, school_id, route_id, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [profileId, childId, body.schoolId, body.routeId || null, 'active']
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
        'CHILD_CREATED',
        userId,
        memberId,
        body.householdId,
        'CHILD',
        childId,
        {
          firstName: body.firstName,
          gradeLevel: body.gradeLevel,
        },
      ]
    );
    
    logger.info('Child created', { childId, householdId: body.householdId });
    
    res.status(201).json({
      requestId: (req as any).id,
      data: {
        child: {
          id: child.child_id,
          householdId: child.household_id,
          firstName: child.first_name,
          lastInitial: child.last_initial,
          gradeLevel: child.grade_level,
          status: child.status,
          createdAt: child.created_at,
        },
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

// ============================================================================
// GET /children/:childId - Get child details
// ============================================================================

router.get('/:childId', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { childId } = req.params;
    
    // Get child
    const childResult = await query(
      'SELECT * FROM children WHERE child_id = $1',
      [childId]
    );
    
    if (childResult.rows.length === 0) {
      return res.status(404).json({
        requestId: (req as any).id,
        error: {
          code: 'NOT_FOUND',
          message: 'Child not found',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const child = childResult.rows[0];
    
    // Verify user is a member of household
    const memberCheck = await query(
      `SELECT 1 FROM household_members 
       WHERE household_id = $1 AND user_id = $2 AND status = $3`,
      [child.household_id, userId, 'active']
    );
    
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        requestId: (req as any).id,
        error: {
          code: 'FORBIDDEN',
          message: 'User does not have access to this child',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Get school profile
    const profileResult = await query(
      `SELECT csp.*, s.name as school_name, r.name as route_name
       FROM child_school_profiles csp
       LEFT JOIN schools s ON csp.school_id = s.school_id
       LEFT JOIN routes r ON csp.route_id = r.route_id
       WHERE csp.child_id = $1 AND csp.status = $2`,
      [childId, 'active']
    );
    
    const schoolProfile = profileResult.rows.length > 0 ? {
      schoolId: profileResult.rows[0].school_id,
      schoolName: profileResult.rows[0].school_name,
      routeId: profileResult.rows[0].route_id,
      routeName: profileResult.rows[0].route_name,
    } : null;
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        child: {
          id: child.child_id,
          householdId: child.household_id,
          firstName: child.first_name,
          lastInitial: child.last_initial,
          gradeLevel: child.grade_level,
          status: child.status,
          schoolProfile,
          createdAt: child.created_at,
        },
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

// ============================================================================
// PATCH /children/:childId - Update child
// ============================================================================

router.patch('/:childId', authenticate, requireIdempotency, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { childId } = req.params;
    const body: UpdateChildRequest = req.body;
    
    // Get child
    const childResult = await query(
      'SELECT * FROM children WHERE child_id = $1',
      [childId]
    );
    
    if (childResult.rows.length === 0) {
      return res.status(404).json({
        requestId: (req as any).id,
        error: {
          code: 'NOT_FOUND',
          message: 'Child not found',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const child = childResult.rows[0];
    
    // Verify user is a member of household
    const memberCheck = await query(
      `SELECT 1 FROM household_members 
       WHERE household_id = $1 AND user_id = $2 AND status = $3`,
      [child.household_id, userId, 'active']
    );
    
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        requestId: (req as any).id,
        error: {
          code: 'FORBIDDEN',
          message: 'User does not have permission to update this child',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (body.firstName) {
      updates.push(`first_name = $${paramIndex}`);
      values.push(body.firstName.trim());
      paramIndex++;
    }
    
    if (body.lastInitial) {
      if (body.lastInitial.length !== 1 || !/^[A-Z]$/i.test(body.lastInitial)) {
        return res.status(400).json({
          requestId: (req as any).id,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Last initial must be a single letter',
          },
          timestamp: new Date().toISOString(),
        });
      }
      updates.push(`last_initial = $${paramIndex}`);
      values.push(body.lastInitial.toUpperCase());
      paramIndex++;
    }
    
    if (body.gradeLevel) {
      const validGrades = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
      if (!validGrades.includes(body.gradeLevel)) {
        return res.status(400).json({
          requestId: (req as any).id,
          error: {
            code: 'INVALID_GRADE',
            message: 'Grade level must be K or 1-12',
          },
          timestamp: new Date().toISOString(),
        });
      }
      updates.push(`grade_level = $${paramIndex}`);
      values.push(body.gradeLevel);
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
    values.push(childId);
    
    const updateQuery = `
      UPDATE children 
      SET ${updates.join(', ')}
      WHERE child_id = $${paramIndex}
      RETURNING *
    `;
    
    const updateResult = await query(updateQuery, values);
    const updatedChild = updateResult.rows[0];
    
    logger.info('Child updated', { childId });
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        child: {
          id: updatedChild.child_id,
          firstName: updatedChild.first_name,
          lastInitial: updatedChild.last_initial,
          gradeLevel: updatedChild.grade_level,
          updatedAt: updatedChild.updated_at,
        },
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

export default router;
