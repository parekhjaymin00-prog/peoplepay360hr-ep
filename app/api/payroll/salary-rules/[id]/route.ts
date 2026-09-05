import { NextRequest } from 'next/server';
import { z } from 'zod';
import { SalaryRuleCategory, ComputationType } from '@prisma/client';
import { requireAuth } from '@/lib/auth/guards';
import { AuthorizationError } from '@/lib/errors';
import { SalaryRuleService } from '@/lib/services/salary-rule.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

const updateRuleSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.nativeEnum(SalaryRuleCategory).optional(),
  sequence: z.number().int().optional(),
  computationType: z.nativeEnum(ComputationType).optional(),
  amount: z.number().optional().nullable(),
  fixedAmount: z.number().optional().nullable(),
  percentage: z.number().optional().nullable(),
  percentageRate: z.number().optional().nullable(),
  percentageBaseCode: z.string().optional().nullable(),
  formula: z.string().optional().nullable(),
  formulaExpression: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
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
      user.permissions.includes('payroll.rule.read') ||
      user.permissions.includes('salary.rule.read');

    if (!hasRead) {
      throw new AuthorizationError('You do not have permission to view salary rules');
    }

    const { id } = await params;
    const rule = await SalaryRuleService.getRuleById(id);
    return jsonSuccess({ rule });
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
      user.permissions.includes('payroll.rule.write') ||
      user.permissions.includes('salary.rule.manage');

    if (!hasWrite) {
      throw new AuthorizationError('You do not have permission to manage salary rules');
    }

    const { id } = await params;
    const body = await request.json();
    const data = updateRuleSchema.parse(body);

    const rule = await SalaryRuleService.updateRule(id, data);
    return jsonSuccess({ rule });
  } catch (error) {
    return jsonError(error);
  }
}
