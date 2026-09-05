import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth, requirePermission } from '@/lib/auth/guards';
import { JobPositionService } from '@/lib/services/job-position.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

const createJobPositionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  code: z.string().min(1, 'Code is required'),
  departmentId: z.string().uuid('Valid department ID is required'),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;
    const departmentId = searchParams.get('departmentId') ?? undefined;

    const jobPositions = await JobPositionService.listJobPositions(departmentId);
    return jsonSuccess({ jobPositions });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, 'job_position.manage');
    const body = await request.json();
    const data = createJobPositionSchema.parse(body);

    const jobPosition = await JobPositionService.createJobPosition(data);
    return jsonSuccess({ jobPosition }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
