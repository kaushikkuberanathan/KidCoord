/**
 * Needs API Routes
 * Handles Need creation, cancellation, and querying
 */

import { Router, Request, Response } from 'express';
import { query, transaction, generateId } from '@/utils/database';
import { logger } from '@/utils/logger';
import {
  validateNeedTransition,
  NeedStatus,
  StateMachine,
} from '@/utils/stateMachine';
import { requireIdempotency } from '@/middleware/idempotency';

const router = Router();

// ============================================================================
// TYPES
// ============================================================================

interface CreateNeedRequest {
  childId: string;
  needType: 'DROP_OFF' | 'PICKUP' | 'HOSTING';
  date: string; // YYYY-MM-DD
  windowStartAt: string; // ISO 8601
  windowEndAt: string; // ISO 8601
}

interface Need {
  need_id: string;
  household_id: string;
  child_id: string;
  need_type: string;
  date: string;
  window_start_at: Date;
  window_end_at: Date;
  status: NeedStatus;
  created_by_member_id: string;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// POST /needs - Create a need
// ============================================================================

router.post('/', requireIdempotency, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id; // From auth middleware
    const body: CreateNeedRequest = req.body;
    
    // Validation
    if (!body.childId || !body.needType || !body.date || !body.windowStartAt || !body.windowEndAt) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields',
          details: {
            required: ['childId', 'needType', 'date', 'windowStartAt', 'windowEndAt'],
          },
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Validate need type
    if (!['DROP_OFF', 'PICKUP', 'HOSTING'].includes(body.needType)) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid needType',
          details: {
            needType: body.needType,
            allowed: ['DROP_OFF', 'PICKUP', 'HOSTING'],
          },
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
    
    // Create need
    const needId = generateId('need');
    
    // Get household_id and member_id from child
    const childResult = await query<{ household_id: string }>(
      'SELECT household_id FROM children WHERE child_id = $1 AND status = $2',
      [body.childId, 'active']
    );
    
    if (childResult.rows.length === 0) {
      return res.status(404).json({
        requestId: (req as any).id,
        error: {
          code: 'NOT_FOUND',
          message: 'Child not found or inactive',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const householdId = childResult.rows[0].household_id;
    
    // Get member_id for current user in this household
    const memberResult = await query<{ household_member_id: string }>(
      'SELECT household_member_id FROM household_members WHERE household_id = $1 AND user_id = $2 AND status = $3',
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
    
    const memberId = memberResult.rows[0].household_member_id;
    
    // Insert need
    // Note: Unique constraint will prevent duplicate OPEN/ASSIGNED needs per child/date
    const insertResult = await query<Need>(
      `INSERT INTO needs (
        need_id, household_id, child_id, need_type, date,
        window_start_at, window_end_at, status, created_by_member_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        needId,
        householdId,
        body.childId,
        body.needType,
        body.date,
        body.windowStartAt,
        body.windowEndAt,
        NeedStatus.OPEN,
        memberId,
      ]
    );
    
    const need = insertResult.rows[0];
    
    // Create audit event
    await query(
      `INSERT INTO audit_events (
        audit_event_id, event_type, actor_user_id, actor_member_id,
        household_id, entity_type, entity_id, event_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
      [
        generateId('audit'),
        'NEED_CREATED',
        userId,
        memberId,
        householdId,
        'NEED',
        needId,
        { needType: body.needType, date: body.date },
      ]
    );
    
    logger.info('Need created', {
      needId,
      childId: body.childId,
      needType: body.needType,
      userId,
    });
    
    // Return response
    res.status(201).json({
      requestId: (req as any).id,
      data: {
        need: {
          id: need.need_id,
          householdId: need.household_id,
          childId: need.child_id,
          needType: need.need_type,
          date: need.date,
          windowStartAt: need.window_start_at,
          windowEndAt: need.window_end_at,
          status: need.status,
          createdByMemberId: need.created_by_member_id,
          createdAt: need.created_at,
          updatedAt: need.updated_at,
        },
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    // Handle constraint violations
    if (error.code === '23505') {
      // Unique constraint violation - duplicate need
      return res.status(409).json({
        requestId: (req as any).id,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'An active need already exists for this child on this date',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    throw error;
  }
});

// ============================================================================
// PATCH /needs/:needId/cancel - Cancel a need
// ============================================================================

router.patch('/:needId/cancel', requireIdempotency, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { needId } = req.params;
    
    // Get current need
    const needResult = await query<Need>(
      'SELECT * FROM needs WHERE need_id = $1',
      [needId]
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
    
    // Validate state transition
    try {
      validateNeedTransition(need.status as NeedStatus, NeedStatus.CANCELLED);
    } catch (error: any) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: error.toJSON(),
        timestamp: new Date().toISOString(),
      });
    }
    
    // Verify user has permission (member of household)
    const memberResult = await query(
      'SELECT 1 FROM household_members WHERE household_id = $1 AND user_id = $2 AND status = $3',
      [need.household_id, userId, 'active']
    );
    
    if (memberResult.rows.length === 0) {
      return res.status(403).json({
        requestId: (req as any).id,
        error: {
          code: 'FORBIDDEN',
          message: 'User is not authorized to cancel this need',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Update need status
    const updateResult = await query<Need>(
      'UPDATE needs SET status = $1, updated_at = NOW() WHERE need_id = $2 RETURNING *',
      [NeedStatus.CANCELLED, needId]
    );
    
    const updatedNeed = updateResult.rows[0];
    
    // Create audit event
    await query(
      `INSERT INTO audit_events (
        audit_event_id, event_type, actor_user_id, household_id,
        entity_type, entity_id, event_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        generateId('audit'),
        'NEED_CANCELLED',
        userId,
        need.household_id,
        'NEED',
        needId,
      ]
    );
    
    logger.info('Need cancelled', { needId, userId });
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        need: {
          id: updatedNeed.need_id,
          status: updatedNeed.status,
          updatedAt: updatedNeed.updated_at,
        },
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

// ============================================================================
// GET /needs - Query needs
// ============================================================================

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const {
      householdId,
      date,
      status,
      childId,
    } = req.query;
    
    // Build query
    let queryText = `
      SELECT n.*, c.first_name, c.last_initial
      FROM needs n
      JOIN children c ON n.child_id = c.child_id
      WHERE 1=1
    `;
    const queryParams: any[] = [];
    let paramIndex = 1;
    
    if (householdId) {
      queryText += ` AND n.household_id = $${paramIndex}`;
      queryParams.push(householdId);
      paramIndex++;
    }
    
    if (date) {
      queryText += ` AND n.date = $${paramIndex}`;
      queryParams.push(date);
      paramIndex++;
    }
    
    if (status) {
      const statuses = (status as string).split(',');
      queryText += ` AND n.status = ANY($${paramIndex})`;
      queryParams.push(statuses);
      paramIndex++;
    }
    
    if (childId) {
      queryText += ` AND n.child_id = $${paramIndex}`;
      queryParams.push(childId);
      paramIndex++;
    }
    
    queryText += ' ORDER BY n.date DESC, n.created_at DESC';
    
    const result = await query(queryText, queryParams);
    
    const needs = result.rows.map((row: any) => ({
      id: row.need_id,
      householdId: row.household_id,
      childId: row.child_id,
      child: {
        firstName: row.first_name,
        lastInitial: row.last_initial,
      },
      needType: row.need_type,
      date: row.date,
      windowStartAt: row.window_start_at,
      windowEndAt: row.window_end_at,
      status: row.status,
      createdByMemberId: row.created_by_member_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        needs,
        total: needs.length,
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

export default router;
