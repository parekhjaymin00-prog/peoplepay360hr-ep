import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/guards';
import { TimeOffService } from '@/lib/services/time-off.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

const refuseRequestSchema = z.object({
  refusalReason: z.string().min(1, 'A refusal reason is required when refusing a leave request'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission(request, 'timeoff.request.approve');
    const { id } = await params;
    const body = await request.json();
    const data = refuseRequestSchema.parse(body);

    const timeOffRequest = await TimeOffService.refuseRequest(id, data.refusalReason, user);
    return jsonSuccess({ request: timeOffRequest });
  } catch (error) {
    return jsonError(error);
  }
}
