/**
 * OTP Utilities
 * One-Time Password generation and verification
 * 
 * Currently uses MOCK provider for development
 * TODO: Swap with Twilio/Firebase in production
 */

import crypto from 'crypto';
import { logger } from './logger';
import { query } from './database';

const OTP_LENGTH = 6;
const OTP_EXPIRATION_MINUTES = 10;
const OTP_PROVIDER = process.env.OTP_PROVIDER || 'MOCK'; // MOCK | TWILIO | FIREBASE

/**
 * Generate random OTP code
 */
function generateOTPCode(): string {
  // Generate random 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return code;
}

/**
 * Send OTP via configured provider
 */
export async function sendOTP(phone: string): Promise<string> {
  const code = generateOTPCode();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRATION_MINUTES);
  
  // Store OTP in database
  await query(
    `INSERT INTO otp_codes (phone, code, expires_at, attempts, created_at)
     VALUES ($1, $2, $3, 0, NOW())
     ON CONFLICT (phone) 
     DO UPDATE SET code = $2, expires_at = $3, attempts = 0, created_at = NOW()`,
    [phone, code, expiresAt]
  );
  
  // Send OTP via provider
  if (OTP_PROVIDER === 'MOCK') {
    // Mock provider - just log the code
    logger.info('🔐 OTP Code (MOCK)', { phone, code, expiresAt });
    console.log(`\n🔐 OTP Code for ${phone}: ${code} (expires in ${OTP_EXPIRATION_MINUTES} minutes)\n`);
  } else if (OTP_PROVIDER === 'TWILIO') {
    // TODO: Implement Twilio
    logger.warn('Twilio OTP not implemented yet, using MOCK');
    console.log(`\n🔐 OTP Code for ${phone}: ${code} (expires in ${OTP_EXPIRATION_MINUTES} minutes)\n`);
  } else if (OTP_PROVIDER === 'FIREBASE') {
    // TODO: Implement Firebase
    logger.warn('Firebase OTP not implemented yet, using MOCK');
    console.log(`\n🔐 OTP Code for ${phone}: ${code} (expires in ${OTP_EXPIRATION_MINUTES} minutes)\n`);
  }
  
  return code;
}

/**
 * Verify OTP code
 */
export async function verifyOTP(phone: string, code: string): Promise<boolean> {
  // Get OTP from database
  const result = await query(
    `SELECT code, expires_at, attempts FROM otp_codes WHERE phone = $1`,
    [phone]
  );
  
  if (result.rows.length === 0) {
    logger.warn('OTP verification failed: no code found', { phone });
    return false;
  }
  
  const otpRecord = result.rows[0];
  
  // Check expiration
  if (new Date() > new Date(otpRecord.expires_at)) {
    logger.warn('OTP verification failed: expired', { phone });
    await query(`DELETE FROM otp_codes WHERE phone = $1`, [phone]);
    return false;
  }
  
  // Check attempts (max 3)
  if (otpRecord.attempts >= 3) {
    logger.warn('OTP verification failed: too many attempts', { phone });
    await query(`DELETE FROM otp_codes WHERE phone = $1`, [phone]);
    return false;
  }
  
  // Verify code
  if (otpRecord.code !== code) {
    // Increment attempts
    await query(
      `UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = $1`,
      [phone]
    );
    logger.warn('OTP verification failed: invalid code', { phone, attempts: otpRecord.attempts + 1 });
    return false;
  }
  
  // Success! Delete OTP
  await query(`DELETE FROM otp_codes WHERE phone = $1`, [phone]);
  logger.info('OTP verified successfully', { phone });
  
  return true;
}

/**
 * Format phone number to E.164 format
 * +1234567890
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Assume US number if no country code
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // Already has country code
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // International number
  return `+${digits}`;
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Must be 10 digits (US) or 11+ (international)
  return digits.length >= 10 && digits.length <= 15;
}
