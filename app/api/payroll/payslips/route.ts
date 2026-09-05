import { NextRequest } from 'next/server';
import { PayslipStatus } from '@prisma/client';
import { requireAuth } from '@/lib/auth/guards';
import { PayrunService } from '@/lib/services/payrun.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;

    const employeeId = searchParams.get('employeeId') ?? undefined;
    const payrunId = searchParams.get('payrunId') ?? undefined;
    const status = (searchParams.get('status') as PayslipStatus) ?? undefined;
    const startDate = searchParams.get('startDate') || searchParams.get('periodStart') || undefined;
    const endDate = searchParams.get('endDate') || searchParams.get('periodEnd') || undefined;

    const payslips = await PayrunService.listPayslips(
      { employeeId, payrunId, status, startDate, endDate },
      user
    );

    return jsonSuccess({ payslips });
  } catch (error) {
    return jsonError(error);
  }
}
