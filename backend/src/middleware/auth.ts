/**
 * Authentication Middleware
 * Protects routes with JWT token verification
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from '@/utils/jwt';
import { logger } from '@/utils/logger';

/**
 * Authenticate request with JWT token
 * Adds user to request object
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Extract token from Authorization header
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      return res.status(401).json({
        requestId: (req as any).id,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No authentication token provided',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Verify token
    try {
      const payload = verifyToken(token);
      
      // Only allow access tokens (not refresh tokens)
      if (payload.type !== 'access') {
        return res.status(401).json({
          requestId: (req as any).id,
          error: {
            code: 'INVALID_TOKEN_TYPE',
            message: 'Must use access token, not refresh token',
          },
          timestamp: new Date().toISOString(),
        });
      }
      
      // Add user to request
      (req as any).user = {
        id: payload.userId,
        phone: payload.phone,
      };
      
      logger.debug('Request authenticated', {
        userId: payload.userId,
        path: req.path,
        method: req.method,
      });
      
      next();
    } catch (error: any) {
      if (error.message === 'TOKEN_EXPIRED') {
        return res.status(401).json({
          requestId: (req as any).id,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Authentication token has expired',
          },
          timestamp: new Date().toISOString(),
        });
      }
      
      if (error.message === 'INVALID_TOKEN') {
        return res.status(401).json({
          requestId: (req as any).id,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Authentication token is invalid',
          },
          timestamp: new Date().toISOString(),
        });
      }
      
      return res.status(401).json({
        requestId: (req as any).id,
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: 'Token verification failed',
        },
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    logger.error('Authentication middleware error', { error: error.message });
    return res.status(500).json({
      requestId: (req as any).id,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication failed',
      },
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Optional authentication
 * Adds user to request if token is valid, but doesn't fail if missing
 */
export function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  const token = extractTokenFromHeader(req.headers.authorization);
  
  if (!token) {
    // No token, but that's okay
    next();
    return;
  }
  
  try {
    const payload = verifyToken(token);
    
    if (payload.type === 'access') {
      (req as any).user = {
        id: payload.userId,
        phone: payload.phone,
      };
    }
  } catch (error) {
    // Invalid token, but we don't fail the request
    logger.debug('Optional auth: invalid token', { error });
  }
  
  next();
}
