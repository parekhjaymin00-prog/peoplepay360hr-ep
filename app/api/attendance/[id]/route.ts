import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AttendanceStatus } from '@prisma/client';
import { requireAuth, requirePermission } from '@/lib/auth/guards';
import { AttendanceService } from '@/lib/services/attendance.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

const manualCorrectionSchema = z.object({
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().nullable().optional(),
  status: z.nativeEnum(AttendanceStatus).optional(),
  correctionReason: z.string().min(1, 'A correction reason is required for manual adjustments'),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const attendance = await AttendanceService.getAttendanceById(id, user);
    return jsonSuccess({ attendance });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission(request, 'attendance.correct');
    const { id } = await params;
    const body = await request.json();
    const data = manualCorrectionSchema.parse(body);

    const attendance = await AttendanceService.correctAttendance(id, data, user.id);
    return jsonSuccess({ attendance });
  } catch (error) {
    return jsonError(error);
  }
}
