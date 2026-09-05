import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Gender, EmploymentType, EmployeeStatus } from '@prisma/client';
import { requireAuth, requirePermission } from '@/lib/auth/guards';
import { EmployeeService } from '@/lib/services/employee.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

const createEmployeeSchema = z.object({
  employeeNumber: z.string().min(1, 'Badge number is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be 'YYYY-MM-DD'").nullable().optional(),
  gender: z.nativeEnum(Gender).optional(),
  departmentId: z.string().uuid('Valid department ID is required'),
  jobPositionId: z.string().uuid('Valid job position ID is required'),
  managerId: z.string().uuid().nullable().optional(),
  workingScheduleId: z.string().uuid('Valid working schedule ID is required'),
  employmentType: z.nativeEnum(EmploymentType),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Hire date must be 'YYYY-MM-DD'"),
  bankName: z.string().nullable().optional(),
  bankAccountNumber: z.string().nullable().optional(),
  bankRoutingCode: z.string().nullable().optional(),
  panOrTaxId: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  emergencyContact: z.string().nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'employee.read');
    const searchParams = request.nextUrl.searchParams;

    const departmentId = searchParams.get('departmentId') ?? undefined;
    const status = (searchParams.get('status') as EmployeeStatus) ?? undefined;
    const employmentType = (searchParams.get('employmentType') as EmploymentType) ?? undefined;
    const search = searchParams.get('search') ?? undefined;

    const employees = await EmployeeService.listEmployees({
      departmentId,
      status,
      employmentType,
      search,
    });

    return jsonSuccess({ employees });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, 'employee.write');
    const body = await request.json();
    const data = createEmployeeSchema.parse(body);

    const employee = await EmployeeService.createEmployee(data);
    return jsonSuccess({ employee }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
