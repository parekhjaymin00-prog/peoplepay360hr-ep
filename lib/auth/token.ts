import jwt from 'jsonwebtoken';
import { JWTPayload } from './types';

const JWT_EXPIRES_IN = '8h';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is missing in production');
    }
    return 'default-dev-jwt-secret-peoplepay360-security-minimum-32-chars';
  }
  return secret;
}

/**
 * Signs a JWT token containing authenticated user identity.
 */
export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: 'HS256',
  });
}

/**
 * Verifies a JWT token and returns its decoded payload, or null if invalid or expired.
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
    });
    return decoded as JWTPayload;
  } catch {
    return null;
  }
}
