import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { AuthorizationError } from '@/lib/errors';
import { SalaryStructureService } from '@/lib/services/salary-structure.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

const createStructureSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  type: z.enum(['BASIC', 'GROSS', 'NET']),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const hasRead =
      user.role.code === 'ADMIN' ||
      user.permissions.includes('payroll.structure.read') ||
      user.permissions.includes('salary.structure.read');

    if (!hasRead) {
      throw new AuthorizationError('You do not have permission to view salary structures');
    }

    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const structures = await SalaryStructureService.listStructures(includeInactive);
    return jsonSuccess({ structures });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const hasWrite =
      user.role.code === 'ADMIN' ||
      user.permissions.includes('payroll.structure.write') ||
      user.permissions.includes('salary.structure.manage');

    if (!hasWrite) {
      throw new AuthorizationError('You do not have permission to manage salary structures');
    }

    const body = await request.json();
    const data = createStructureSchema.parse(body);

    const structure = await SalaryStructureService.createStructure(data);
    return jsonSuccess({ structure }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
