import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/guards';
import { TimeOffService } from '@/lib/services/time-off.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission(request, 'timeoff.allocation.manage');
    const { id } = await params;
    const allocation = await TimeOffService.approveAllocation(id, user.id);
    return jsonSuccess({ allocation });
  } catch (error) {
    return jsonError(error);
  }
}
