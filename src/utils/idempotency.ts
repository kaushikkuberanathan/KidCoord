/**
 * Idempotency Key Utilities
 * Generates unique keys for safe API request retries on unreliable mobile networks
 */

// ============================================================================
// TYPES
// ============================================================================

export type IdempotencyKey = string;

export interface IdempotencyOptions {
  /** Optional prefix to namespace keys (e.g. 'ride', 'need') */
  prefix?: string;
}

// ============================================================================
// UUID v4 GENERATION
// ============================================================================

/**
 * Generate a UUID v4 string.
 * Uses crypto.getRandomValues (available in RN 0.73+ via Hermes) with a
 * Math.random fallback for environments where crypto is unavailable.
 */
function generateUUIDv4(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // Set version 4 (bits 12-15 of time_hi_and_version)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Set variant bits (bits 6-7 of clock_seq_hi_and_reserved)
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0'));
    return [
      hex.slice(0, 4).join(''),
      hex.slice(4, 6).join(''),
      hex.slice(6, 8).join(''),
      hex.slice(8, 10).join(''),
      hex.slice(10, 16).join(''),
    ].join('-');
  }

  // Fallback: Math.random-based UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Generate a unique idempotency key (UUID v4).
 *
 * @example
 * const key = generateIdempotencyKey();
 * // => 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
 *
 * const rideKey = generateIdempotencyKey({ prefix: 'ride' });
 * // => 'ride_f47ac10b-58cc-4372-a567-0e02b2c3d479'
 */
export function generateIdempotencyKey(options?: IdempotencyOptions): IdempotencyKey {
  const uuid = generateUUIDv4();
  return options?.prefix ? `${options.prefix}_${uuid}` : uuid;
}

/**
 * Validate that a string is a well-formed idempotency key.
 * Accepts bare UUID v4 or prefixed UUID v4 (e.g. 'ride_<uuid>').
 */
export function isValidIdempotencyKey(key: string): boolean {
  const uuidV4Pattern = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
  return new RegExp(`^([a-z]+_)?${uuidV4Pattern}$`, 'i').test(key);
}
