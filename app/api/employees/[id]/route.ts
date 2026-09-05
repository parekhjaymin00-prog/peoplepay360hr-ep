import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Gender, EmploymentType, EmployeeStatus } from '@prisma/client';
import { requireAuth, requirePermission } from '@/lib/auth/guards';
import { EmployeeService } from '@/lib/services/employee.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';
import { AuthorizationError } from '@/lib/errors';

const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  gender: z.nativeEnum(Gender).optional(),
  departmentId: z.string().uuid().optional(),
  jobPositionId: z.string().uuid().optional(),
  managerId: z.string().uuid().nullable().optional(),
  workingScheduleId: z.string().uuid().optional(),
  employmentType: z.nativeEnum(EmploymentType).optional(),
  status: z.nativeEnum(EmployeeStatus).optional(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  terminationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  bankName: z.string().nullable().optional(),
  bankAccountNumber: z.string().nullable().optional(),
  bankRoutingCode: z.string().nullable().optional(),
  panOrTaxId: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  emergencyContact: z.string().nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    // Authorization: Either user has 'employee.read' or user is accessing their own employee profile
    const isSelf = user.employee?.id === id;
    const canReadSelf = user.permissions.includes('employee.self.read');
    const canReadAll = user.permissions.includes('employee.read') || user.role.code === 'ADMIN';

    if (!canReadAll && !(isSelf && canReadSelf)) {
      throw new AuthorizationError('You do not have permission to view this employee record');
    }

    const employee = await EmployeeService.getEmployeeById(id);
    return jsonSuccess({ employee });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'employee.write');
    const { id } = await params;
    const body = await request.json();
    const data = updateEmployeeSchema.parse(body);

    const employee = await EmployeeService.updateEmployee(id, data);
    return jsonSuccess({ employee });
  } catch (error) {
    return jsonError(error);
  }
}
