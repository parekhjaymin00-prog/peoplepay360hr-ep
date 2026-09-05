import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth, requirePermission } from '@/lib/auth/guards';
import { JobPositionService } from '@/lib/services/job-position.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

const updateJobPositionSchema = z.object({
  title: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  departmentId: z.string().uuid().optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const jobPosition = await JobPositionService.getJobPositionById(id);
    return jsonSuccess({ jobPosition });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'job_position.manage');
    const { id } = await params;
    const body = await request.json();
    const data = updateJobPositionSchema.parse(body);

    const jobPosition = await JobPositionService.updateJobPosition(id, data);
    return jsonSuccess({ jobPosition });
  } catch (error) {
    return jsonError(error);
  }
}
