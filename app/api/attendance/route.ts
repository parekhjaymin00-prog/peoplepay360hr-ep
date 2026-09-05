import { NextRequest } from 'next/server';
import { AttendanceStatus } from '@prisma/client';
import { requireAuth } from '@/lib/auth/guards';
import { AttendanceService } from '@/lib/services/attendance.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;

    const employeeId = searchParams.get('employeeId') ?? undefined;
    const departmentId = searchParams.get('departmentId') ?? undefined;
    const startDate = searchParams.get('startDate') ?? undefined;
    const endDate = searchParams.get('endDate') ?? undefined;
    const status = (searchParams.get('status') as AttendanceStatus) ?? undefined;

    const attendances = await AttendanceService.listAttendance(
      {
        employeeId,
        departmentId,
        startDate,
        endDate,
        status,
      },
      user
    );

    return jsonSuccess({ attendances });
  } catch (error) {
    return jsonError(error);
  }
}
