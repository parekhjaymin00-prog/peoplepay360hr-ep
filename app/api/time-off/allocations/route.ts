import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AllocationStatus } from '@prisma/client';
import { requireAuth, requirePermission } from '@/lib/auth/guards';
import { TimeOffService } from '@/lib/services/time-off.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

const createAllocationSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  timeOffTypeId: z.string().uuid('Invalid time off type ID'),
  allocatedQuantity: z.number().positive('Allocated quantity must be greater than 0'),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validFrom must be in YYYY-MM-DD format'),
  validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validTo must be in YYYY-MM-DD format'),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;

    const employeeId = searchParams.get('employeeId') ?? undefined;
    const timeOffTypeId = searchParams.get('timeOffTypeId') ?? undefined;
    const status = (searchParams.get('status') as AllocationStatus) ?? undefined;

    const allocations = await TimeOffService.listAllocations(
      { employeeId, timeOffTypeId, status },
      user
    );
    return jsonSuccess({ allocations });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission(request, 'timeoff.allocation.manage');
    const body = await request.json();
    const data = createAllocationSchema.parse(body);

    const allocation = await TimeOffService.createAllocation(data, user.id);
    return jsonSuccess({ allocation }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
