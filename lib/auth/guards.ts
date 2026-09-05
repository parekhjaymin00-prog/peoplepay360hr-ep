import { verifyToken } from './token';
import { AuthService } from '../services/auth.service';
import { SafeUser } from './types';
import { AuthenticationError, AuthorizationError } from '../errors';

/**
 * Extracts Bearer token from the Authorization header or token cookie.
 */
export function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // Also check cookie header
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    const tokenCookie = cookies.find((c) => c.startsWith('token='));
    if (tokenCookie) {
      return decodeURIComponent(tokenCookie.split('=')[1]);
    }
  }

  return null;
}

/**
 * Validates request authentication and returns the current SafeUser.
 * Throws AuthenticationError (401) if missing, invalid, or deactivated.
 */
export async function requireAuth(request: Request): Promise<SafeUser> {
  const token = extractToken(request);
  if (!token) {
    throw new AuthenticationError('Authentication token is missing. Please log in.');
  }

  const payload = verifyToken(token);
  if (!payload) {
    throw new AuthenticationError('Authentication token is invalid or has expired.');
  }

  const user = await AuthService.getCurrentUser(payload.userId);
  if (!user) {
    throw new AuthenticationError('Authenticated user not found or inactive.');
  }

  return user;
}

/**
 * Verifies that the authenticated user possesses the specified permission code.
 * Throws AuthenticationError (401) if not logged in.
 * Throws AuthorizationError (403) if permission is missing.
 */
export async function requirePermission(request: Request, permissionCode: string): Promise<SafeUser> {
  const user = await requireAuth(request);

  // Admin role automatically has all permissions
  if (user.role.code === 'ADMIN') {
    return user;
  }

  const hasPerm = user.permissions.includes(permissionCode);
  if (!hasPerm) {
    throw new AuthorizationError(
      `Permission denied. Required permission: '${permissionCode}'. Your role '${user.role.name}' does not have this capability.`
    );
  }

  return user;
}
