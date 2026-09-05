import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/guards';
import { PayrunService } from '@/lib/services/payrun.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission(request, 'payroll.payrun.compute');
    const { id } = await params;
    const payrun = await PayrunService.computePayrun(id, user);
    return jsonSuccess({ payrun });
  } catch (error) {
    return jsonError(error);
  }
}
