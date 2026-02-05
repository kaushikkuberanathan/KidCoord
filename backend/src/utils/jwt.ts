/**
 * JWT Utilities
 * Token generation, validation, and refresh
 */

import jwt from 'jsonwebtoken';
import { logger } from './logger';

const JWT_SECRET = process.env.JWT_SECRET || 'kidcoord-dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // 7 days
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d'; // 30 days

export interface JWTPayload {
  userId: string;
  phone: string;
  type: 'access' | 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Generate access and refresh tokens
 */
export function generateTokens(userId: string, phone: string): TokenPair {
  // Access token (short-lived)
  const accessToken = jwt.sign(
    {
      userId,
      phone,
      type: 'access',
    } as JWTPayload,
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  
  // Refresh token (long-lived)
  const refreshToken = jwt.sign(
    {
      userId,
      phone,
      type: 'refresh',
    } as JWTPayload,
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );
  
  // Calculate expiration time in seconds
  const decoded = jwt.decode(accessToken) as any;
  const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
  
  logger.debug('Tokens generated', { userId, expiresIn });
  
  return {
    accessToken,
    refreshToken,
    expiresIn,
  };
}

/**
 * Verify and decode token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return payload;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('TOKEN_EXPIRED');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('INVALID_TOKEN');
    }
    throw new Error('TOKEN_VERIFICATION_FAILED');
  }
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }
  
  // Expected format: "Bearer <token>"
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
}
