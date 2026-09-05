import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { AuthorizationError } from '@/lib/errors';
import { SalaryStructureService } from '@/lib/services/salary-structure.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

const updateStructureSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['BASIC', 'GROSS', 'NET']).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const hasRead =
      user.role.code === 'ADMIN' ||
      user.permissions.includes('payroll.structure.read') ||
      user.permissions.includes('salary.structure.read');

    if (!hasRead) {
      throw new AuthorizationError('You do not have permission to view salary structures');
    }

    const { id } = await params;
    const structure = await SalaryStructureService.getStructureById(id);
    return jsonSuccess({ structure });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const hasWrite =
      user.role.code === 'ADMIN' ||
      user.permissions.includes('payroll.structure.write') ||
      user.permissions.includes('salary.structure.manage');

    if (!hasWrite) {
      throw new AuthorizationError('You do not have permission to manage salary structures');
    }

    const { id } = await params;
    const body = await request.json();
    const data = updateStructureSchema.parse(body);

    const structure = await SalaryStructureService.updateStructure(id, data);
    return jsonSuccess({ structure });
  } catch (error) {
    return jsonError(error);
  }
}
