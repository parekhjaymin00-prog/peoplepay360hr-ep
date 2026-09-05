import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth, requirePermission } from '@/lib/auth/guards';
import { DepartmentService } from '@/lib/services/department.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Department name is required'),
  code: z.string().min(1, 'Department code is required'),
  managerId: z.string().uuid().nullable().optional(),
  parentDepartmentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const departments = await DepartmentService.listDepartments();
    return jsonSuccess({ departments });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, 'department.manage');
    const body = await request.json();
    const data = createDepartmentSchema.parse(body);

    const department = await DepartmentService.createDepartment(data);
    return jsonSuccess({ department }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
