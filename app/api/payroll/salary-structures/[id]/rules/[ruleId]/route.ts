import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { AuthorizationError } from '@/lib/errors';
import { SalaryStructureService } from '@/lib/services/salary-structure.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

const updateOverrideSchema = z.object({
  sequenceOverride: z.number().int().nullable().optional(),
});

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
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

    const { id, ruleId } = await params;
    await SalaryStructureService.removeRuleFromStructure(id, ruleId);
    return jsonSuccess({ message: 'Rule removed from structure successfully' });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
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

    const { id, ruleId } = await params;
    const body = await request.json();
    const data = updateOverrideSchema.parse(body);

    const updated = await SalaryStructureService.updateRuleSequenceOverride(
      id,
      ruleId,
      data.sequenceOverride ?? null
    );
    return jsonSuccess({ assignment: updated });
  } catch (error) {
    return jsonError(error);
  }
}
