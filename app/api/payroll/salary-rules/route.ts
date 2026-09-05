import { NextRequest } from 'next/server';
import { z } from 'zod';
import { SalaryRuleCategory, ComputationType } from '@prisma/client';
import { requireAuth } from '@/lib/auth/guards';
import { AuthorizationError } from '@/lib/errors';
import { SalaryRuleService } from '@/lib/services/salary-rule.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

const createRuleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  category: z.nativeEnum(SalaryRuleCategory),
  sequence: z.number().int().optional(),
  computationType: z.nativeEnum(ComputationType),
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

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const hasRead =
      user.role.code === 'ADMIN' ||
      user.permissions.includes('payroll.rule.read') ||
      user.permissions.includes('salary.rule.read');

    if (!hasRead) {
      throw new AuthorizationError('You do not have permission to view salary rules');
    }

    const searchParams = request.nextUrl.searchParams;
    const category = (searchParams.get('category') as SalaryRuleCategory) ?? undefined;
    const isActiveParam = searchParams.get('isActive');
    const isActive = isActiveParam !== null ? isActiveParam === 'true' : undefined;

    const rules = await SalaryRuleService.listRules({ category, isActive });
    return jsonSuccess({ rules });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const hasWrite =
      user.role.code === 'ADMIN' ||
      user.permissions.includes('payroll.rule.write') ||
      user.permissions.includes('salary.rule.manage');

    if (!hasWrite) {
      throw new AuthorizationError('You do not have permission to manage salary rules');
    }

    const body = await request.json();
    const data = createRuleSchema.parse(body);

    const rule = await SalaryRuleService.createRule(data);
    return jsonSuccess({ rule }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
