import { generateIdempotencyKey, isValidIdempotencyKey } from '../idempotency';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PREFIXED_UUID_V4_REGEX = /^[a-z]+_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('generateIdempotencyKey', () => {
  it('returns a valid UUID v4 string', () => {
    const key = generateIdempotencyKey();
    expect(UUID_V4_REGEX.test(key)).toBe(true);
  });

  it('returns a unique key on each call', () => {
    const keys = new Set(Array.from({ length: 1000 }, () => generateIdempotencyKey()));
    expect(keys.size).toBe(1000);
  });

  it('returns a string type', () => {
    expect(typeof generateIdempotencyKey()).toBe('string');
  });

  it('returns a prefixed key when prefix option is provided', () => {
    const key = generateIdempotencyKey({ prefix: 'ride' });
    expect(PREFIXED_UUID_V4_REGEX.test(key)).toBe(true);
    expect(key.startsWith('ride_')).toBe(true);
  });

  it('UUID portion of prefixed key is valid UUID v4', () => {
    const key = generateIdempotencyKey({ prefix: 'need' });
    const uuid = key.replace('need_', '');
    expect(UUID_V4_REGEX.test(uuid)).toBe(true);
  });

  it('returns bare UUID when no options are provided', () => {
    const key = generateIdempotencyKey();
    expect(key).not.toContain('_');
  });

  it('returns bare UUID when prefix is undefined', () => {
    const key = generateIdempotencyKey({});
    expect(UUID_V4_REGEX.test(key)).toBe(true);
  });
});

describe('isValidIdempotencyKey', () => {
  it('returns true for a valid UUID v4', () => {
    const key = generateIdempotencyKey();
    expect(isValidIdempotencyKey(key)).toBe(true);
  });

  it('returns true for a prefixed UUID v4', () => {
    const key = generateIdempotencyKey({ prefix: 'ride' });
    expect(isValidIdempotencyKey(key)).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(isValidIdempotencyKey('')).toBe(false);
  });

  it('returns false for a random string', () => {
    expect(isValidIdempotencyKey('not-a-uuid')).toBe(false);
  });

  it('returns false for a UUID v1 (wrong version digit)', () => {
    expect(isValidIdempotencyKey('550e8400-e29b-11d4-a716-446655440000')).toBe(false);
  });

  it('returns false for a UUID v4 with wrong variant', () => {
    // variant bits should be 8, 9, a, or b — using 'c' is invalid
    expect(isValidIdempotencyKey('f47ac10b-58cc-4372-c567-0e02b2c3d479')).toBe(false);
  });
});
