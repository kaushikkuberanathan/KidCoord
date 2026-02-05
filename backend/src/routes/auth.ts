/**
 * Authentication API Routes
 * OTP-based authentication with JWT tokens
 */

import { Router, Request, Response } from 'express';
import { query, generateId, hashSensitiveData } from '@/utils/database';
import { logger } from '@/utils/logger';
import { sendOTP, verifyOTP, formatPhoneNumber, isValidPhoneNumber } from '@/utils/otp';
import { generateTokens, verifyToken } from '@/utils/jwt';
import { authenticate } from '@/middleware/auth';
import { requireIdempotency } from '@/middleware/idempotency';

const router = Router();

// ============================================================================
// TYPES
// ============================================================================

interface RequestOTPRequest {
  phone: string;
}

interface VerifyOTPRequest {
  phone: string;
  code: string;
}

interface RefreshTokenRequest {
  refreshToken: string;
}

// ============================================================================
// POST /auth/otp/request - Request OTP code
// ============================================================================

router.post('/otp/request', async (req: Request, res: Response) => {
  try {
    const body: RequestOTPRequest = req.body;
    
    // Validation
    if (!body.phone) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Phone number is required',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Validate phone format
    if (!isValidPhoneNumber(body.phone)) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'INVALID_PHONE',
          message: 'Phone number must be 10-15 digits',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Format phone number
    const phone = formatPhoneNumber(body.phone);
    
    // Send OTP
    await sendOTP(phone);
    
    logger.info('OTP requested', { phone });
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        phone,
        message: 'OTP code sent successfully',
        expiresInMinutes: 10,
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    logger.error('OTP request failed', { error: error.message });
    throw error;
  }
});

// ============================================================================
// POST /auth/otp/verify - Verify OTP and login
// ============================================================================

router.post('/otp/verify', requireIdempotency, async (req: Request, res: Response) => {
  try {
    const body: VerifyOTPRequest = req.body;
    
    // Validation
    if (!body.phone || !body.code) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Phone number and code are required',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Validate code format
    if (!/^\d{6}$/.test(body.code)) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'INVALID_CODE',
          message: 'Code must be 6 digits',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Format phone
    const phone = formatPhoneNumber(body.phone);
    
    // Verify OTP
    const isValid = await verifyOTP(phone, body.code);
    
    if (!isValid) {
      return res.status(401).json({
        requestId: (req as any).id,
        error: {
          code: 'INVALID_OTP',
          message: 'Invalid or expired OTP code',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Check if user exists
    const phoneHash = hashSensitiveData(phone);
    let userResult = await query(
      'SELECT user_id, phone, status FROM users WHERE phone_hash = $1',
      [phoneHash]
    );
    
    let userId: string;
    let isNewUser = false;
    
    if (userResult.rows.length === 0) {
      // Create new user
      userId = generateId('user');
      
      await query(
        `INSERT INTO users (user_id, phone, phone_hash, status, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [userId, phone, phoneHash, 'active']
      );
      
      isNewUser = true;
      logger.info('New user created', { userId, phone });
    } else {
      const user = userResult.rows[0];
      userId = user.user_id;
      
      // Check if user is active
      if (user.status !== 'active') {
        return res.status(403).json({
          requestId: (req as any).id,
          error: {
            code: 'USER_INACTIVE',
            message: 'User account is not active',
          },
          timestamp: new Date().toISOString(),
        });
      }
      
      logger.info('Existing user logged in', { userId, phone });
    }
    
    // Generate tokens
    const tokens = generateTokens(userId, phone);
    
    // Create session
    const sessionId = generateId('session');
    await query(
      `INSERT INTO sessions (
        session_id, user_id, access_token_hash, refresh_token_hash,
        expires_at, created_at
      ) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days', NOW())`,
      [
        sessionId,
        userId,
        hashSensitiveData(tokens.accessToken),
        hashSensitiveData(tokens.refreshToken),
      ]
    );
    
    logger.info('Session created', { userId, sessionId });
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        user: {
          id: userId,
          phone,
          isNewUser,
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        },
        sessionId,
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

// ============================================================================
// POST /auth/refresh - Refresh access token
// ============================================================================

router.post('/refresh', requireIdempotency, async (req: Request, res: Response) => {
  try {
    const body: RefreshTokenRequest = req.body;
    
    // Validation
    if (!body.refreshToken) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Refresh token is required',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Verify refresh token
    let payload;
    try {
      payload = verifyToken(body.refreshToken);
    } catch (error: any) {
      return res.status(401).json({
        requestId: (req as any).id,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is invalid or expired',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Must be a refresh token
    if (payload.type !== 'refresh') {
      return res.status(401).json({
        requestId: (req as any).id,
        error: {
          code: 'INVALID_TOKEN_TYPE',
          message: 'Must provide refresh token',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Verify session exists
    const tokenHash = hashSensitiveData(body.refreshToken);
    const sessionResult = await query(
      `SELECT session_id, user_id FROM sessions 
       WHERE refresh_token_hash = $1 AND expires_at > NOW()`,
      [tokenHash]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(401).json({
        requestId: (req as any).id,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found or expired',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const session = sessionResult.rows[0];
    
    // Generate new tokens
    const tokens = generateTokens(payload.userId, payload.phone);
    
    // Update session with new tokens
    await query(
      `UPDATE sessions 
       SET access_token_hash = $1, 
           refresh_token_hash = $2,
           expires_at = NOW() + INTERVAL '7 days',
           updated_at = NOW()
       WHERE session_id = $3`,
      [
        hashSensitiveData(tokens.accessToken),
        hashSensitiveData(tokens.refreshToken),
        session.session_id,
      ]
    );
    
    logger.info('Tokens refreshed', { userId: payload.userId, sessionId: session.session_id });
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        },
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

// ============================================================================
// GET /auth/session - Bootstrap session (get user data)
// ============================================================================

router.get('/session', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Get user details
    const userResult = await query(
      'SELECT user_id, phone, status, created_at FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        requestId: (req as any).id,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const user = userResult.rows[0];
    
    // Get user's households and memberships
    const householdsResult = await query(
      `SELECT h.household_id, h.name, hm.household_member_id, hm.roles, hm.status as member_status
       FROM households h
       JOIN household_members hm ON h.household_id = hm.household_id
       WHERE hm.user_id = $1
       ORDER BY h.created_at DESC`,
      [userId]
    );
    
    const households = householdsResult.rows.map(row => ({
      id: row.household_id,
      name: row.name,
      membership: {
        id: row.household_member_id,
        roles: row.roles,
        status: row.member_status,
      },
    }));
    
    logger.info('Session bootstrapped', { userId });
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        user: {
          id: user.user_id,
          phone: user.phone,
          status: user.status,
          createdAt: user.created_at,
        },
        households,
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

// ============================================================================
// POST /auth/logout - End session
// ============================================================================

router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(400).json({
        requestId: (req as any).id,
        error: {
          code: 'NO_TOKEN',
          message: 'No token provided',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    const token = authHeader.split(' ')[1];
    const tokenHash = hashSensitiveData(token);
    
    // Delete session
    await query(
      'DELETE FROM sessions WHERE user_id = $1 AND access_token_hash = $2',
      [userId, tokenHash]
    );
    
    logger.info('User logged out', { userId });
    
    res.status(200).json({
      requestId: (req as any).id,
      data: {
        message: 'Logged out successfully',
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    throw error;
  }
});

export default router;
