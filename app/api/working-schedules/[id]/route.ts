import { NextRequest } from 'next/server';
import { z } from 'zod';
import { DayOfWeek } from '@prisma/client';
import { requireAuth, requirePermission } from '@/lib/auth/guards';
import { WorkingScheduleService } from '@/lib/services/schedule.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

const scheduleDaySchema = z.object({
  dayOfWeek: z.nativeEnum(DayOfWeek),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Format must be 'HH:mm'"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Format must be 'HH:mm'"),
  breakMinutes: z.number().int().nonnegative().optional(),
});

const updateScheduleSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  days: z.array(scheduleDaySchema).min(1).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const schedule = await WorkingScheduleService.getScheduleById(id);
    return jsonSuccess({ schedule });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'schedule.manage');
    const { id } = await params;
    const body = await request.json();
    const data = updateScheduleSchema.parse(body);

    const schedule = await WorkingScheduleService.updateSchedule(id, data);
    return jsonSuccess({ schedule });
  } catch (error) {
    return jsonError(error);
  }
}
