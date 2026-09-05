import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { AttendanceService } from '@/lib/services/attendance.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const attendance = await AttendanceService.checkOut(user.id);
    return jsonSuccess({ attendance });
  } catch (error) {
    return jsonError(error);
  }
}
