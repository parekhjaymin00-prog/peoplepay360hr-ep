import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { AuthorizationError } from '@/lib/errors';
import { SalaryStructureService } from '@/lib/services/salary-structure.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

const assignRuleSchema = z.object({
  salaryRuleId: z.string().uuid('Invalid salary rule ID'),
  sequenceOverride: z.number().int().optional().nullable(),
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
    return jsonSuccess({ rules: structure.orderedRules });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
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
    const data = assignRuleSchema.parse(body);

    const assignment = await SalaryStructureService.assignRuleToStructure(id, data);
    return jsonSuccess({ assignment }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
