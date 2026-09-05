import { AuthService } from '../lib/services/auth.service';
import { verifyToken } from '../lib/auth/token';
import { requireAuth, requirePermission } from '../lib/auth/guards';
import { AuthenticationError, AuthorizationError } from '../lib/errors';
import prisma from '../lib/prisma';

async function runAuthTests() {
  console.log('🧪 Starting PeoplePay360 Authentication & RBAC Engine Tests...\n');
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (error: any) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${error.message || error}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Valid Login
  // --------------------------------------------------------------------------
  let adminToken = '';
  let employeeToken = '';
  let hrToken = '';

  await test('Valid login returns token and SafeUser without passwordHash', async () => {
    const session = await AuthService.login('admin@peoplepay360.com', 'Password123!');
    if (!session.token) throw new Error('Token was not generated');
    if (!session.user.id) throw new Error('User ID missing');
    if ((session.user as any).passwordHash) throw new Error('Security violation: passwordHash exposed in SafeUser!');
    if (session.user.role.code !== 'ADMIN') throw new Error(`Expected ADMIN role, got ${session.user.role.code}`);
    if (session.user.permissions.length < 20) throw new Error(`Expected all permissions, got ${session.user.permissions.length}`);

    adminToken = session.token;
  });

  // --------------------------------------------------------------------------
  // TEST 2: Invalid Password
  // --------------------------------------------------------------------------
  await test('Login with incorrect password throws AuthenticationError', async () => {
    try {
      await AuthService.login('admin@peoplepay360.com', 'WrongPassword!');
      throw new Error('Authentication should have failed with wrong password');
    } catch (e: any) {
      if (!(e instanceof AuthenticationError)) {
        throw new Error(`Expected AuthenticationError, got ${e.constructor.name}: ${e.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Nonexistent User
  // --------------------------------------------------------------------------
  await test('Login with nonexistent email throws AuthenticationError', async () => {
    try {
      await AuthService.login('nonexistent.user@peoplepay360.com', 'Password123!');
      throw new Error('Authentication should have failed for nonexistent user');
    } catch (e: any) {
      if (!(e instanceof AuthenticationError)) {
        throw new Error(`Expected AuthenticationError, got ${e.constructor.name}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Token Verification
  // --------------------------------------------------------------------------
  await test('Token verification validates claims and rejects tampered tokens', async () => {
    const payload = verifyToken(adminToken);
    if (!payload || payload.email !== 'admin@peoplepay360.com') {
      throw new Error('Valid token failed to verify');
    }

    const tampered = adminToken.slice(0, -5) + 'xxxxx';
    const invalidPayload = verifyToken(tampered);
    if (invalidPayload !== null) {
      throw new Error('Tampered token should have failed verification');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: Authenticated User Retrieval (getCurrentUser)
  // --------------------------------------------------------------------------
  await test('getCurrentUser returns full SafeUser with linked employee details', async () => {
    const empSession = await AuthService.login('john.doe@peoplepay360.com', 'Password123!');
    employeeToken = empSession.token;

    const user = await AuthService.getCurrentUser(empSession.user.id);
    if (!user) throw new Error('Failed to retrieve current user');
    if (user.email !== 'john.doe@peoplepay360.com') throw new Error('Email mismatch');
    if (!user.employee) throw new Error('Linked employee record missing for John Doe');
    if (user.employee.employeeNumber !== 'EMP-00102') {
      throw new Error(`Expected EMP-00102, got ${user.employee.employeeNumber}`);
    }
    if (user.employee.department.code !== 'ENG') {
      throw new Error(`Expected ENG department, got ${user.employee.department.code}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: requireAuth Guard (Valid vs Unauthenticated)
  // --------------------------------------------------------------------------
  await test('requireAuth helper accepts valid Bearer token and rejects unauthenticated request', async () => {
    // Valid request
    const validReq = new Request('http://localhost:3000/api/auth/me', {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    const authUser = await requireAuth(validReq);
    if (authUser.email !== 'john.doe@peoplepay360.com') {
      throw new Error('Authenticated user mismatch');
    }

    // Unauthenticated request
    const noTokenReq = new Request('http://localhost:3000/api/auth/me');
    try {
      await requireAuth(noTokenReq);
      throw new Error('requireAuth should have thrown on missing token');
    } catch (e: any) {
      if (!(e instanceof AuthenticationError)) throw e;
    }

    // Invalid token request
    const badTokenReq = new Request('http://localhost:3000/api/auth/me', {
      headers: { Authorization: 'Bearer bad-invalid-token' },
    });
    try {
      await requireAuth(badTokenReq);
      throw new Error('requireAuth should have thrown on invalid token');
    } catch (e: any) {
      if (!(e instanceof AuthenticationError)) throw e;
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: Authorization - Permission Checks (Authorized vs Unauthorized)
  // --------------------------------------------------------------------------
  await test('requirePermission authorizes allowed action and forbids unauthorized action', async () => {
    const hrSession = await AuthService.login('hr.manager@peoplepay360.com', 'Password123!');
    hrToken = hrSession.token;

    // HR Manager has 'contract.write'
    const hrAllowedReq = new Request('http://localhost:3000/api/contracts', {
      headers: { Authorization: `Bearer ${hrToken}` },
    });
    const allowedUser = await requirePermission(hrAllowedReq, 'contract.write');
    if (!allowedUser) throw new Error('HR Manager should have contract.write permission');

    // Employee does NOT have 'contract.write'
    const empForbiddenReq = new Request('http://localhost:3000/api/contracts', {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    try {
      await requirePermission(empForbiddenReq, 'contract.write');
      throw new Error('Employee should not have contract.write permission');
    } catch (e: any) {
      if (!(e instanceof AuthorizationError)) {
        throw new Error(`Expected AuthorizationError, got ${e.constructor.name}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: Role-based Admin Superuser Override
  // --------------------------------------------------------------------------
  await test('Admin role automatically satisfies any required permission', async () => {
    const adminReq = new Request('http://localhost:3000/api/anything', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // Admin passes arbitrary permission checks
    const user1 = await requirePermission(adminReq, 'payroll.payrun.pay');
    const user2 = await requirePermission(adminReq, 'contract.write');
    const user3 = await requirePermission(adminReq, 'admin.permission.manage');

    if (!user1 || !user2 || !user3) {
      throw new Error('Admin must satisfy all permission checks');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 9: Role Permission Matrix Retrieval
  // --------------------------------------------------------------------------
  await test('getRolePermissionMatrix returns all canonical roles and permission mappings', async () => {
    const matrix = await AuthService.getRolePermissionMatrix();
    if (matrix.length !== 5) {
      throw new Error(`Expected 5 roles in matrix, got ${matrix.length}`);
    }

    const employeeRole = matrix.find((r) => r.code === 'EMPLOYEE');
    const hrRole = matrix.find((r) => r.code === 'HR_MANAGER');
    const adminRole = matrix.find((r) => r.code === 'ADMIN');

    if (!employeeRole || !hrRole || !adminRole) {
      throw new Error('Canonical roles missing from matrix');
    }

    if (!employeeRole.permissions.includes('timeoff.request.self')) {
      throw new Error('Employee missing self timeoff permission');
    }
    if (employeeRole.permissions.includes('payroll.payrun.create')) {
      throw new Error('Employee should not have payroll.payrun.create permission');
    }
    if (!hrRole.permissions.includes('timeoff.request.approve')) {
      throw new Error('HR Manager missing timeoff.request.approve permission');
    }
  });

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log(`\n========================================`);
  console.log(`Auth Tests Finished: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthTests()
  .catch((e) => {
    console.error('Fatal auth test error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
