import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth, requirePermission } from '@/lib/auth/guards';
import { DepartmentService } from '@/lib/services/department.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

const updateDepartmentSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  managerId: z.string().uuid().nullable().optional(),
  parentDepartmentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const department = await DepartmentService.getDepartmentById(id);
    return jsonSuccess({ department });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'department.manage');
    const { id } = await params;
    const body = await request.json();
    const data = updateDepartmentSchema.parse(body);

    const department = await DepartmentService.updateDepartment(id, data);
    return jsonSuccess({ department });
  } catch (error) {
    return jsonError(error);
  }
}
