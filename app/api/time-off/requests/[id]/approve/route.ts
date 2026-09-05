import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/guards';
import { TimeOffService } from '@/lib/services/time-off.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission(request, 'timeoff.request.approve');
    const { id } = await params;
    const timeOffRequest = await TimeOffService.approveRequest(id, user);
    return jsonSuccess({ request: timeOffRequest });
  } catch (error) {
    return jsonError(error);
  }
}
