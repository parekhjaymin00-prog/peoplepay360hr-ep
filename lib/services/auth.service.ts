import prisma from '../prisma';
import { verifyPassword } from '../auth/password';
import { signToken } from '../auth/token';
import { AuthSession, SafeUser, RolePermissionMatrixItem } from '../auth/types';
import { AuthenticationError, AuthorizationError } from '../errors';

export class AuthService {
  /**
   * Authenticates a user with email and password.
   * Updates lastLoginAt and generates a JWT session token.
   * Never exposes passwordHash.
   */
  static async login(emailInput: string, passwordInput: string): Promise<AuthSession> {
    const normalizedEmail = emailInput.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
        employee: {
          include: {
            department: true,
            jobPosition: true,
          },
        },
      },
    });

    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new AuthenticationError('Account is deactivated. Please contact an administrator.');
    }

    const isPasswordValid = await verifyPassword(passwordInput, user.passwordHash);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Update lastLoginAt asynchronously without blocking response
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const permissions = user.role.permissions.map((rp) => rp.permission.code);

    const safeUser: SafeUser = {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      role: {
        id: user.role.id,
        code: user.role.code,
        name: user.role.name,
      },
      permissions,
      employee: user.employee
        ? {
            id: user.employee.id,
            employeeNumber: user.employee.employeeNumber,
            firstName: user.employee.firstName,
            lastName: user.employee.lastName,
            department: {
              id: user.employee.department.id,
              name: user.employee.department.name,
              code: user.employee.department.code,
            },
            jobPosition: {
              id: user.employee.jobPosition.id,
              title: user.employee.jobPosition.title,
              code: user.employee.jobPosition.code,
            },
          }
        : null,
    };

    const token = signToken({
      userId: user.id,
      email: user.email,
      roleCode: user.role.code,
    });

    return {
      token,
      user: safeUser,
    };
  }

  /**
   * Retrieves user profile, role, and effective permissions by user ID.
   */
  static async getCurrentUser(userId: string): Promise<SafeUser | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
        employee: {
          include: {
            department: true,
            jobPosition: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    const permissions = user.role.permissions.map((rp) => rp.permission.code);

    return {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      role: {
        id: user.role.id,
        code: user.role.code,
        name: user.role.name,
      },
      permissions,
      employee: user.employee
        ? {
            id: user.employee.id,
            employeeNumber: user.employee.employeeNumber,
            firstName: user.employee.firstName,
            lastName: user.employee.lastName,
            department: {
              id: user.employee.department.id,
              name: user.employee.department.name,
              code: user.employee.department.code,
            },
            jobPosition: {
              id: user.employee.jobPosition.id,
              title: user.employee.jobPosition.title,
              code: user.employee.jobPosition.code,
            },
          }
        : null,
    };
  }

  /**
   * Authoritatively checks if a user has a specific permission code.
   * ADMIN role automatically satisfies all permissions.
   */
  static async hasPermission(userId: string, permissionCode: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return false;
    }

    // Admin role override
    if (user.role.code === 'ADMIN') {
      return true;
    }

    return user.role.permissions.some((rp) => rp.permission.code === permissionCode);
  }

  /**
   * Returns all roles and their assigned permission codes.
   */
  static async getRolePermissionMatrix(): Promise<RolePermissionMatrixItem[]> {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: { permission: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      isSystem: r.isSystem,
      permissions: r.permissions.map((rp) => rp.permission.code),
    }));
  }
}
