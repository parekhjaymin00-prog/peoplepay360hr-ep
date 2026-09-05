import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/guards';
import { PayrunService } from '@/lib/services/payrun.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'payroll.payrun.read');
    const { id } = await params;
    const payrun = await PayrunService.getPayrunById(id);
    return jsonSuccess({ payrun });
  } catch (error) {
    return jsonError(error);
  }
}
