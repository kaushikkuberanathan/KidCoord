/**
 * Blocklists API Routes
 * Manage child-specific driver blocklists for safety
 * 
 * Parents can block specific drivers from offering rides to their children
 * Already enforced in offer-requests API - these endpoints provide CRUD
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

interface CreateBlocklistRequest {
  childId: string;
  blockedMemberId: string;
  reason?: string;
}

// ============================================================================
// GET /blocklists - List blocklists for user's children
// ============================================================================

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { childId } = req.query;
    
    // Build query
    let queryText = `
      SELECT b.*, 
             c.first_name as child_first_name, c.last_initial as child_last_initial,
             hm.user_id as blocked_user_id, u.phone as blocked_phone
      FROM blocklists b
      JOIN children c ON b.child_id = c.child_id
      JOIN household_members hm ON b.blocked_member_id = hm.household_member_id
      JOIN users u ON hm.user_id = u.user_id
      WHERE c.household_id IN (
        SELECT household_id FROM household_members 
        WHERE user_id = $1 AND status = $2
      ) AND b.status = $3
    `;
    const params: any[] = [userId, 'active', 'active'];
    
    if (childId) {
      queryText += ' AND b.child_id = $4';
      params.push(childId);
    }
    
    queryText += ' ORDER BY b.created_at DESC';
    
    const result = await query(queryText, params);
    
    const blocklists = result.rows.map(row => ({
      id: row.blocklist_id,
      childId: row.child_id,
      child: {
        firstName: row.child_first_name,
        lastInitial: row.child_last_initial,
      },
      blockedMemberId: row.blocked_member_id,
      blockedUser: {
        userId: row.blocked_user_id,
        phone: row.blocked_phone,
      },
      reason: row.reason,
      createdAt: row.created_at,
    }));
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        blocklists,
        total: blocklists.length,
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

// ============================================================================
// POST /blocklists - Block a driver for a child
// ============================================================================

router.post('/', authenticate, requireIdempotency, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const body: CreateBlocklistRequest = req.body;
    
    // Validation
    if (!body.childId || !body.blockedMemberId) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'childId and blockedMemberId are required',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Get child and verify user owns it
    const childResult = await query(
      `SELECT c.*, hm.household_member_id as owner_member_id
       FROM children c
       JOIN household_members hm ON c.household_id = hm.household_id
       WHERE c.child_id = $1 AND hm.user_id = $2 AND hm.status = $3`,
      [body.childId, userId, 'active']
    );
    
    if (childResult.rows.length === 0) {
      return res.status(403).json({
        requestId: (req as any).id,
        error: {
          code: 'FORBIDDEN',
          message: 'User does not have permission to manage this child',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const child = childResult.rows[0];
    const ownerMemberId = child.owner_member_id;
    
    // Verify blocked member exists and has DRIVER role
    const blockedMemberResult = await query(
      `SELECT * FROM household_members WHERE household_member_id = $1 AND status = $2`,
      [body.blockedMemberId, 'active']
    );
    
    if (blockedMemberResult.rows.length === 0) {
      return res.status(404).json({
        requestId: (req as any).id,
        error: {
          code: 'NOT_FOUND',
          message: 'Blocked member not found',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const blockedMember = blockedMemberResult.rows[0];
    
    if (!blockedMember.roles.includes('DRIVER')) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'NOT_A_DRIVER',
          message: 'Member does not have DRIVER role',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Check if already blocked
    const existingBlock = await query(
      `SELECT 1 FROM blocklists 
       WHERE child_id = $1 AND blocked_member_id = $2 AND status = $3`,
      [body.childId, body.blockedMemberId, 'active']
    );
    
    if (existingBlock.rows.length > 0) {
      return res.status(409).json({
        requestId: (req as any).id,
        error: {
          code: 'ALREADY_BLOCKED',
          message: 'This driver is already blocked for this child',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Can't block yourself
    if (ownerMemberId === body.blockedMemberId) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'CANNOT_BLOCK_SELF',
          message: 'Cannot block yourself',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Create blocklist entry
    const blocklistId = generateId('blocklist');
    const blockResult = await query(
      `INSERT INTO blocklists (
        blocklist_id, child_id, blocked_member_id, reason, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *`,
      [blocklistId, body.childId, body.blockedMemberId, body.reason || null, 'active']
    );
    
    const blocklist = blockResult.rows[0];
    
    // Create audit event
    await query(
      `INSERT INTO audit_events (
        audit_event_id, event_type, actor_user_id, actor_member_id,
        household_id, entity_type, entity_id, event_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
      [
        generateId('audit'),
        'DRIVER_BLOCKED',
        userId,
        ownerMemberId,
        child.household_id,
        'BLOCKLIST',
        blocklistId,
        {
          childId: body.childId,
          blockedMemberId: body.blockedMemberId,
        },
      ]
    );
    
    logger.info('Driver blocked', {
      blocklistId,
      childId: body.childId,
      blockedMemberId: body.blockedMemberId,
    });
    
    res.status(201).json({
      requestId: (req as any).id,
      data: {
        blocklist: {
          id: blocklist.blocklist_id,
          childId: blocklist.child_id,
          blockedMemberId: blocklist.blocked_member_id,
          reason: blocklist.reason,
          status: blocklist.status,
          createdAt: blocklist.created_at,
        },
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

// ============================================================================
// DELETE /blocklists/:blocklistId - Unblock a driver
// ============================================================================

router.delete('/:blocklistId', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { blocklistId } = req.params;
    
    // Get blocklist
    const blockResult = await query(
      `SELECT b.*, c.household_id
       FROM blocklists b
       JOIN children c ON b.child_id = c.child_id
       WHERE b.blocklist_id = $1`,
      [blocklistId]
    );
    
    if (blockResult.rows.length === 0) {
      return res.status(404).json({
        requestId: (req as any).id,
        error: {
          code: 'NOT_FOUND',
          message: 'Blocklist entry not found',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const blocklist = blockResult.rows[0];
    
    // Verify user is member of household
    const memberCheck = await query(
      `SELECT household_member_id FROM household_members 
       WHERE household_id = $1 AND user_id = $2 AND status = $3`,
      [blocklist.household_id, userId, 'active']
    );
    
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        requestId: (req as any).id,
        error: {
          code: 'FORBIDDEN',
          message: 'User does not have permission to unblock this driver',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const memberId = memberCheck.rows[0].household_member_id;
    
    // Update status to removed (soft delete)
    await query(
      `UPDATE blocklists SET status = $1, updated_at = NOW() WHERE blocklist_id = $2`,
      ['removed', blocklistId]
    );
    
    // Create audit event
    await query(
      `INSERT INTO audit_events (
        audit_event_id, event_type, actor_user_id, actor_member_id,
        household_id, entity_type, entity_id, event_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
      [
        generateId('audit'),
        'DRIVER_UNBLOCKED',
        userId,
        memberId,
        blocklist.household_id,
        'BLOCKLIST',
        blocklistId,
        {
          childId: blocklist.child_id,
          blockedMemberId: blocklist.blocked_member_id,
        },
      ]
    );
    
    logger.info('Driver unblocked', {
      blocklistId,
      childId: blocklist.child_id,
      blockedMemberId: blocklist.blocked_member_id,
    });
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        message: 'Driver unblocked successfully',
        blocklistId,
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

export default router;
