-- Migration: Add OTP codes table
-- Run this SQL to add OTP functionality to existing database

CREATE TABLE IF NOT EXISTS otp_codes (
  phone VARCHAR(20) PRIMARY KEY,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for cleanup of expired codes
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes(expires_at);

-- Cleanup function for expired OTP codes (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_otp_codes()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM otp_codes WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
