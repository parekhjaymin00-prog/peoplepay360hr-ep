import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth, requirePermission } from '@/lib/auth/guards';
import { TimeOffService } from '@/lib/services/time-off.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

const updateTypeSchema = z.object({
  name: z.string().min(1).optional(),
  requiresAllocation: z.boolean().optional(),
  isPaid: z.boolean().optional(),
  color: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const type = await TimeOffService.getTypeById(id);
    return jsonSuccess({ type });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'timeoff.type.manage');
    const { id } = await params;
    const body = await request.json();
    const data = updateTypeSchema.parse(body);

    const type = await TimeOffService.updateType(id, data);
    return jsonSuccess({ type });
  } catch (error) {
    return jsonError(error);
  }
}
