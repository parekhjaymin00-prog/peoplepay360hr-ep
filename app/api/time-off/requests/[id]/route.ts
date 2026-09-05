import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { TimeOffService } from '@/lib/services/time-off.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const timeOffRequest = await TimeOffService.getRequestById(id, user);
    return jsonSuccess({ request: timeOffRequest });
  } catch (error) {
    return jsonError(error);
  }
}
