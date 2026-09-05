import prisma from '../prisma';
import { generateUuidV7 } from '../utils/id';
import { DayOfWeek, AttendanceStatus, ContractStatus } from '@prisma/client';
import { SafeUser } from '../auth/types';
import { ValidationError, NotFoundError, BusinessRuleError, AuthorizationError } from '../errors';

const DAY_OF_WEEK_MAP: Record<number, DayOfWeek> = {
  0: DayOfWeek.SUNDAY,
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
};

export interface AttendanceFilter {
  employeeId?: string;
  departmentId?: string;
  startDate?: string; // "YYYY-MM-DD"
  endDate?: string;   // "YYYY-MM-DD"
  status?: AttendanceStatus;
}

export interface ManualCorrectionInput {
  checkIn?: string; // ISO DateTime
  checkOut?: string | null; // ISO DateTime
  status?: AttendanceStatus;
  correctionReason: string;
}

function normalizeCalendarDate(d: Date): Date {
  // Always use UTC calendar date normalized to 00:00:00.000Z to align with PostgreSQL @db.Date
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const date = d.getUTCDate();
  return new Date(Date.UTC(year, month, date));
}

function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map((s) => parseInt(s, 10));
  return hours * 60 + minutes;
}

export class AttendanceService {
  /**
   * Resolves the applicable working schedule for an employee on a given date.
   * Checks for an active contract covering that date with schedule override,
   * otherwise falls back to employee default working schedule.
   */
  static async resolveWorkingSchedule(employeeId: string, targetDate: Date) {
    // 1. Check for active contract
    const contract = await prisma.contract.findFirst({
      where: {
        employeeId,
        status: ContractStatus.ACTIVE,
        startDate: { lte: targetDate },
        OR: [{ endDate: null }, { endDate: { gte: targetDate } }],
      },
      include: {
        workingSchedule: {
          include: {
            days: true,
          },
        },
      },
    });

    if (contract && contract.workingSchedule) {
      return contract.workingSchedule;
    }

    // 2. Fall back to employee default schedule
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        workingSchedule: {
          include: {
            days: true,
          },
        },
      },
    });

    if (!employee || !employee.workingSchedule) {
      throw new BusinessRuleError('Employee does not have an assigned working schedule', 'NO_SCHEDULE_FOUND');
    }

    return employee.workingSchedule;
  }

  /**
   * Authenticated employee check-in.
   * Uses authenticated user identity to prevent client spoofing.
   */
  static async checkIn(userId: string, customCheckInTime?: Date) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true },
    });

    if (!user || !user.employee) {
      throw new BusinessRuleError('Authenticated user is not linked to an employee record', 'NO_LINKED_EMPLOYEE');
    }

    const employee = user.employee;
    const checkInTime = customCheckInTime ?? new Date();
    const calendarDate = normalizeCalendarDate(checkInTime);

    // Check if attendance already exists for today
    const existing = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: calendarDate,
        },
      },
    });

    if (existing) {
      throw new BusinessRuleError(
        'Attendance already recorded for this calendar date. Duplicate check-in is rejected.',
        'ATTENDANCE_ALREADY_EXISTS'
      );
    }

    // Determine applicable working schedule and expected hours
    const schedule = await this.resolveWorkingSchedule(employee.id, calendarDate);
    const dayOfWeek = DAY_OF_WEEK_MAP[checkInTime.getUTCDay()];
    const scheduleDay = schedule.days.find((d) => d.dayOfWeek === dayOfWeek);

    let expectedHours = 0.0;
    let initialStatus: AttendanceStatus = AttendanceStatus.PRESENT;

    if (scheduleDay) {
      expectedHours = Number(scheduleDay.dayWorkHours);

      // Check for LATE status (15-minute grace period from scheduled shift start)
      const scheduledStartMinutes = parseTimeToMinutes(scheduleDay.startTime);
      const checkInMinutes = checkInTime.getUTCHours() * 60 + checkInTime.getUTCMinutes();
      if (checkInMinutes > scheduledStartMinutes + 15) {
        initialStatus = AttendanceStatus.LATE;
      }
    }

    try {
      return await prisma.attendance.create({
        data: {
          id: generateUuidV7(),
          employeeId: employee.id,
          date: calendarDate,
          checkIn: checkInTime,
          checkOut: null,
          workedHours: 0.0,
          expectedHours,
          status: initialStatus,
          isOvertime: false,
          overtimeHours: 0.0,
        },
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeNumber: true },
          },
        },
      });
    } catch (error: any) {
      // Catch concurrent duplicate check-in race condition at DB level
      if (error.code === 'P2002') {
        throw new BusinessRuleError(
          'Attendance already recorded for this calendar date (concurrent check-in caught).',
          'ATTENDANCE_ALREADY_EXISTS'
        );
      }
      throw error;
    }
  }

  /**
   * Authenticated employee check-out.
   * Calculates authoritative workedHours and overtimeHours.
   */
  static async checkOut(userId: string, customCheckOutTime?: Date) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true },
    });

    if (!user || !user.employee) {
      throw new BusinessRuleError('Authenticated user is not linked to an employee record', 'NO_LINKED_EMPLOYEE');
    }

    const employee = user.employee;
    const checkOutTime = customCheckOutTime ?? new Date();
    const calendarDate = normalizeCalendarDate(checkOutTime);

    // Find open attendance record
    const attendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: calendarDate,
        },
      },
    });

    if (!attendance) {
      throw new NotFoundError('No active check-in found for today. Please check in first.');
    }

    if (attendance.checkOut !== null) {
      throw new BusinessRuleError('Employee has already checked out for today.', 'ALREADY_CHECKED_OUT');
    }

    if (checkOutTime <= attendance.checkIn) {
      throw new BusinessRuleError('Check-out time must be strictly after check-in time.', 'INVALID_CHECKOUT_TIME');
    }

    // Calculate worked hours: (checkOut - checkIn) in hours, 2 decimal places
    const diffMs = checkOutTime.getTime() - attendance.checkIn.getTime();
    const workedHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
    const expectedHours = Number(attendance.expectedHours);

    // Overtime logic: max(0, workedHours - expectedHours)
    let overtimeHours = 0.0;
    let isOvertime = false;

    if (workedHours > expectedHours) {
      overtimeHours = parseFloat((workedHours - expectedHours).toFixed(2));
      isOvertime = true;
    }

    // Refine status if worked less than half the expected shift
    let status = attendance.status;
    if (expectedHours > 0 && workedHours < expectedHours * 0.5 && status !== AttendanceStatus.LATE) {
      status = AttendanceStatus.HALF_DAY;
    }

    return prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: checkOutTime,
        workedHours,
        isOvertime,
        overtimeHours,
        status,
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true },
        },
      },
    });
  }

  /**
   * Lists attendance records with filtering and role-based scoping.
   */
  static async listAttendance(filter: AttendanceFilter, requestingUser: SafeUser) {
    const where: any = {};

    // Scoping: If user is ordinary employee without 'attendance.read', restrict to self
    const canReadAll = requestingUser.permissions.includes('attendance.read') || requestingUser.role.code === 'ADMIN';

    if (!canReadAll) {
      if (!requestingUser.employee) {
        throw new AuthorizationError('You do not have access to attendance records');
      }
      where.employeeId = requestingUser.employee.id;
    } else if (filter.employeeId) {
      where.employeeId = filter.employeeId;
    }

    if (filter.status) where.status = filter.status;

    if (filter.startDate || filter.endDate) {
      where.date = {};
      if (filter.startDate) where.date.gte = new Date(filter.startDate);
      if (filter.endDate) where.date.lte = new Date(filter.endDate);
    }

    if (filter.departmentId) {
      where.employee = { departmentId: filter.departmentId };
    }

    return prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
        correctedBy: {
          select: { id: true, email: true },
        },
      },
    });
  }

  /**
   * Retrieves single attendance record by ID with authorization check.
   */
  static async getAttendanceById(id: string, requestingUser: SafeUser) {
    const attendance = await prisma.attendance.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            department: true,
            jobPosition: true,
            workingSchedule: {
              include: { days: true },
            },
          },
        },
        correctedBy: {
          select: { id: true, email: true },
        },
      },
    });

    if (!attendance) {
      throw new NotFoundError(`Attendance record '${id}' not found`);
    }

    const isSelf = requestingUser.employee?.id === attendance.employeeId;
    const canReadAll = requestingUser.permissions.includes('attendance.read') || requestingUser.role.code === 'ADMIN';

    if (!canReadAll && !isSelf) {
      throw new AuthorizationError('You do not have permission to view this attendance record');
    }

    return attendance;
  }

  /**
   * HR-authorized manual attendance correction.
   * Requires non-empty reason and records audit fields.
   */
  static async correctAttendance(id: string, input: ManualCorrectionInput, correctingUserId: string) {
    const attendance = await prisma.attendance.findUnique({
      where: { id },
    });

    if (!attendance) {
      throw new NotFoundError(`Attendance record '${id}' not found`);
    }

    const reason = input.correctionReason.trim();
    if (!reason) {
      throw new ValidationError('A correction reason is required for manual attendance adjustments');
    }

    const checkIn = input.checkIn ? new Date(input.checkIn) : attendance.checkIn;
    const checkOut = input.checkOut !== undefined ? (input.checkOut ? new Date(input.checkOut) : null) : attendance.checkOut;

    if (checkOut && checkOut <= checkIn) {
      throw new BusinessRuleError('Check-out time must be strictly after check-in time', 'INVALID_CHECKOUT_TIME');
    }

    // Recalculate worked hours and overtime
    let workedHours = 0.0;
    let overtimeHours = 0.0;
    let isOvertime = false;

    if (checkOut) {
      const diffMs = checkOut.getTime() - checkIn.getTime();
      workedHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
      const expectedHours = Number(attendance.expectedHours);

      if (workedHours > expectedHours) {
        overtimeHours = parseFloat((workedHours - expectedHours).toFixed(2));
        isOvertime = true;
      }
    }

    return prisma.attendance.update({
      where: { id },
      data: {
        checkIn,
        checkOut,
        workedHours,
        isOvertime,
        overtimeHours,
        status: input.status ?? attendance.status,
        isManualCorrection: true,
        correctionReason: reason,
        correctedById: correctingUserId,
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true },
        },
        correctedBy: {
          select: { id: true, email: true },
        },
      },
    });
  }

  /**
   * Calculates derived absence days for an employee over a date range.
   * Scheduled working days with zero attendance (and no approved leave) are derived as ABSENT.
   */
  static async getAbsenceSummary(employeeId: string, startDate: Date, endDate: Date) {
    const schedule = await this.resolveWorkingSchedule(employeeId, startDate);
    const scheduledDaysOfWeek = new Set(schedule.days.map((d) => d.dayOfWeek));

    // Get all attendances in range
    const attendances = await prisma.attendance.findMany({
      where: {
        employeeId,
        date: { gte: startDate, lte: endDate },
      },
    });

    const attendedDates = new Set(
      attendances.map((a) => a.date.toISOString().split('T')[0])
    );

    const absentDates: string[] = [];
    const curr = new Date(startDate);

    while (curr <= endDate) {
      const dayOfWeek = DAY_OF_WEEK_MAP[curr.getUTCDay()];
      const dateStr = curr.toISOString().split('T')[0];

      // If it's a scheduled workday and employee did not attend
      if (scheduledDaysOfWeek.has(dayOfWeek) && !attendedDates.has(dateStr)) {
        absentDates.push(dateStr);
      }

      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    return {
      totalScheduledWorkdays: absentDates.length + attendances.length,
      attendedDays: attendances.length,
      absentDays: absentDates.length,
      absentDates,
    };
  }
}
