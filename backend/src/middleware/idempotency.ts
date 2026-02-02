/**
 * Idempotency Middleware
 * Prevents duplicate requests using Idempotency-Key header
 */

import { Request, Response, NextFunction } from 'express';
import { query, generateId } from '@/utils/database';
import { logger } from '@/utils/logger';
import crypto from 'crypto';

interface IdempotencyRecord {
  key: string;
  user_id: string;
  route: string;
  request_hash: string;
  response_body: any;
  created_at: Date;
  expires_at: Date;
}

const EXPIRATION_HOURS = 24;

/**
 * Generate hash of request body
 */
function hashRequest(body: any): string {
  const bodyString = JSON.stringify(body || {});
  return crypto.createHash('sha256').update(bodyString).digest('hex');
}

/**
 * Check if idempotency key exists
 */
async function getIdempotencyRecord(
  key: string,
  userId: string
): Promise<IdempotencyRecord | null> {
  const result = await query<IdempotencyRecord>(
    `SELECT * FROM idempotency_keys 
     WHERE key = $1 AND user_id = $2 AND expires_at > NOW()`,
    [key, userId]
  );
  
  return result.rows[0] || null;
}

/**
 * Store idempotency record
 */
async function storeIdempotencyRecord(
  key: string,
  userId: string,
  route: string,
  requestHash: string,
  responseBody: any
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + EXPIRATION_HOURS);
  
  await query(
    `INSERT INTO idempotency_keys 
     (key, user_id, route, request_hash, response_body, created_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6)
     ON CONFLICT (key) DO NOTHING`,
    [key, userId, route, requestHash, responseBody, expiresAt]
  );
}

/**
 * Idempotency middleware
 * 
 * Usage:
 *   router.post('/needs', idempotency, async (req, res) => { ... });
 */
export function idempotency(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Only apply to write operations
  if (req.method === 'GET' || req.method === 'HEAD') {
    return next();
  }
  
  const idempotencyKey = req.headers['idempotency-key'] as string;
  
  // Idempotency key is strongly recommended but not required for all endpoints
  // Some endpoints may choose to require it
  if (!idempotencyKey) {
    logger.warn('Request without idempotency key', {
      method: req.method,
      path: req.path,
      userId: (req as any).user?.id,
    });
    return next();
  }
  
  // Validate key format (UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(idempotencyKey)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_IDEMPOTENCY_KEY',
        message: 'Idempotency key must be a valid UUID',
      },
    });
  }
  
  const userId = (req as any).user?.id;
  if (!userId) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required for idempotent requests',
      },
    });
  }
  
  const route = `${req.method} ${req.path}`;
  const requestHash = hashRequest(req.body);
  
  // Check for existing idempotency record
  (async () => {
    try {
      const existing = await getIdempotencyRecord(idempotencyKey, userId);
      
      if (existing) {
        // Found existing record
        if (existing.request_hash === requestHash) {
          // Same request - return cached response
          logger.info('Idempotent request - returning cached response', {
            idempotencyKey,
            userId,
            route,
          });
          
          return res.status(200).json(existing.response_body);
        } else {
          // Different request with same key - conflict
          logger.warn('Idempotency conflict - same key, different request', {
            idempotencyKey,
            userId,
            route,
          });
          
          return res.status(409).json({
            error: {
              code: 'IDEMPOTENCY_CONFLICT',
              message: 'Same idempotency key used for different request',
            },
          });
        }
      }
      
      // No existing record - proceed with request
      // Intercept response to store it
      const originalJson = res.json.bind(res);
      
      res.json = function (body: any) {
        // Store idempotency record asynchronously
        storeIdempotencyRecord(
          idempotencyKey,
          userId,
          route,
          requestHash,
          body
        ).catch((err) => {
          logger.error('Failed to store idempotency record', {
            error: err.message,
            idempotencyKey,
          });
        });
        
        return originalJson(body);
      };
      
      next();
    } catch (error: any) {
      logger.error('Idempotency middleware error', {
        error: error.message,
        idempotencyKey,
      });
      
      // Don't block request on idempotency errors
      next();
    }
  })();
}

/**
 * Require idempotency key middleware
 * Use this for critical endpoints that must have idempotency
 */
export function requireIdempotency(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const idempotencyKey = req.headers['idempotency-key'] as string;
  
  if (!idempotencyKey) {
    return res.status(400).json({
      error: {
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required for this endpoint',
      },
    });
  }
  
  next();
}

/**
 * Clean up expired idempotency keys
 * Run this periodically (e.g., daily cron job)
 */
export async function cleanupExpiredKeys(): Promise<number> {
  const result = await query(
    'DELETE FROM idempotency_keys WHERE expires_at < NOW()'
  );
  
  const deleted = result.rowCount || 0;
  logger.info('Cleaned up expired idempotency keys', { deleted });
  
  return deleted;
}
