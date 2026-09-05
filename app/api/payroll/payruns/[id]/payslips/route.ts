import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { PayrunService } from '@/lib/services/payrun.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const payslips = await PayrunService.listPayrunPayslips(id, user);
    return jsonSuccess({ payslips });
  } catch (error) {
    return jsonError(error);
  }
}
