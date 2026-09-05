import { NextRequest } from 'next/server';
import { z } from 'zod';
import { PayrunStatus } from '@prisma/client';
import { requireAuth, requirePermission } from '@/lib/auth/guards';
import { PayrunService } from '@/lib/services/payrun.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

const createPayrunSchema = z.object({
  name: z.string().min(1, 'Payrun name is required'),
  salaryStructureId: z.string().uuid('Invalid salary structure ID'),
  periodStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'periodStartDate must be in YYYY-MM-DD format'),
  periodEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'periodEndDate must be in YYYY-MM-DD format'),
  employeeIds: z.array(z.string().uuid()).min(1, 'At least one employee must be selected'),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'payroll.payrun.read');
    const searchParams = request.nextUrl.searchParams;

    const status = (searchParams.get('status') as PayrunStatus) ?? undefined;
    const startDate = searchParams.get('startDate') ?? undefined;
    const endDate = searchParams.get('endDate') ?? undefined;

    const payruns = await PayrunService.listPayruns({ status, startDate, endDate });
    return jsonSuccess({ payruns });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission(request, 'payroll.payrun.create');
    const body = await request.json();
    const data = createPayrunSchema.parse(body);

    const payrun = await PayrunService.createPayrun(data, user);
    return jsonSuccess({ payrun }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
