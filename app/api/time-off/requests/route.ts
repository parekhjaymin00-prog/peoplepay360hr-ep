import { NextRequest } from 'next/server';
import { z } from 'zod';
import { TimeOffStatus } from '@prisma/client';
import { requireAuth } from '@/lib/auth/guards';
import { TimeOffService } from '@/lib/services/time-off.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

const createRequestSchema = z.object({
  employeeId: z.string().uuid().optional(),
  timeOffTypeId: z.string().uuid('Invalid time off type ID'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'startTime must be in HH:mm format').nullable().optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'endTime must be in HH:mm format').nullable().optional(),
  reason: z.string().optional(),
  status: z.nativeEnum(TimeOffStatus).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;

    const employeeId = searchParams.get('employeeId') ?? undefined;
    const timeOffTypeId = searchParams.get('timeOffTypeId') ?? undefined;
    const status = (searchParams.get('status') as TimeOffStatus) ?? undefined;
    const startDate = searchParams.get('startDate') ?? undefined;
    const endDate = searchParams.get('endDate') ?? undefined;

    const requests = await TimeOffService.listRequests(
      { employeeId, timeOffTypeId, status, startDate, endDate },
      user
    );
    return jsonSuccess({ requests });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const data = createRequestSchema.parse(body);

    const timeOffRequest = await TimeOffService.createRequest(data, user);
    return jsonSuccess({ request: timeOffRequest }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
