import { randomBytes } from 'crypto';

/**
 * Generates an RFC 9562 compliant UUIDv7 string.
 *
 * UUIDv7 layout:
 * - 48 bits: Unix timestamp in milliseconds
 * - 4 bits: Version (0b0111 = 7)
 * - 12 bits: Random or counter sequence
 * - 2 bits: Variant (0b10)
 * - 62 bits: Random data
 *
 * Characteristics:
 * - Time-ordered (lexicographically sortable)
 * - Globally unique and collision-resistant
 * - Native 128-bit representation stored in PostgreSQL UUID
 * - Application-generated with zero reliance on DB extensions
 */
export function generateUuidV7(): string {
  const bytes = randomBytes(16);
  const now = BigInt(Date.now());

  // 48-bit timestamp
  bytes[0] = Number((now >> 40n) & 0xffn);
  bytes[1] = Number((now >> 32n) & 0xffn);
  bytes[2] = Number((now >> 24n) & 0xffn);
  bytes[3] = Number((now >> 16n) & 0xffn);
  bytes[4] = Number((now >> 8n) & 0xffn);
  bytes[5] = Number(now & 0xffn);

  // 4-bit version (7) + 12-bit random
  bytes[6] = (bytes[6] & 0x0f) | 0x70;

  // 2-bit variant (10xx) + 6-bit random
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  // Format as standard 8-4-4-4-12 hex string
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Validates whether a string is a standard UUID format.
 */
export function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
