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

const createScheduleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  isActive: z.boolean().optional(),
  days: z.array(scheduleDaySchema).min(1, 'At least one working day is required'),
});

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const schedules = await WorkingScheduleService.listSchedules();
    return jsonSuccess({ schedules });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, 'schedule.manage');
    const body = await request.json();
    const data = createScheduleSchema.parse(body);

    const schedule = await WorkingScheduleService.createSchedule(data);
    return jsonSuccess({ schedule }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
