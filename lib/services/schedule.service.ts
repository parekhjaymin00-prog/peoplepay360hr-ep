import prisma from '../prisma';
import { generateUuidV7 } from '../utils/id';
import { DayOfWeek } from '@prisma/client';
import { ValidationError, NotFoundError, BusinessRuleError } from '../errors';

export interface ScheduleDayInput {
  dayOfWeek: DayOfWeek;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  breakMinutes?: number;
}

export interface CreateScheduleInput {
  name: string;
  code: string;
  isActive?: boolean;
  days: ScheduleDayInput[];
}

export interface UpdateScheduleInput {
  name?: string;
  code?: string;
  isActive?: boolean;
  days?: ScheduleDayInput[];
}

function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  if (parts.length !== 2) {
    throw new ValidationError(`Invalid time format '${timeStr}'. Expected 'HH:mm'`);
  }
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new ValidationError(`Invalid time value '${timeStr}'`);
  }
  return hours * 60 + minutes;
}

function calculateDayHours(startTime: string, endTime: string, breakMinutes: number): number {
  const startM = parseTimeToMinutes(startTime);
  const endM = parseTimeToMinutes(endTime);

  if (endM <= startM) {
    throw new BusinessRuleError(
      `End time '${endTime}' must be strictly later than start time '${startTime}'. Overnight shifts are not supported in MVP.`,
      'INVALID_SHIFT_HOURS'
    );
  }

  const shiftDurationMinutes = endM - startM;
  if (breakMinutes < 0) {
    throw new ValidationError('Break minutes cannot be negative');
  }

  if (breakMinutes >= shiftDurationMinutes) {
    throw new BusinessRuleError(
      `Break duration (${breakMinutes}m) cannot be greater than or equal to total shift duration (${shiftDurationMinutes}m)`,
      'INVALID_BREAK_DURATION'
    );
  }

  const netWorkMinutes = shiftDurationMinutes - breakMinutes;
  return parseFloat((netWorkMinutes / 60).toFixed(2));
}

export class WorkingScheduleService {
  static async createSchedule(input: CreateScheduleInput) {
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();

    if (!input.days || input.days.length === 0) {
      throw new ValidationError('A working schedule must define at least one working day');
    }

    // Check unique code or name
    const existing = await prisma.workingSchedule.findFirst({
      where: {
        OR: [{ code }, { name }],
      },
    });
    if (existing) {
      if (existing.code === code) throw new ValidationError(`Schedule code '${code}' already exists`);
      throw new ValidationError(`Schedule name '${name}' already exists`);
    }

    // Check unique day of week
    const seenDays = new Set<DayOfWeek>();
    for (const d of input.days) {
      if (seenDays.has(d.dayOfWeek)) {
        throw new ValidationError(`Duplicate day of week '${d.dayOfWeek}' in schedule input`);
      }
      seenDays.add(d.dayOfWeek);
    }

    // Calculate hours for each day and total weekly hours
    const processedDays = input.days.map((d) => {
      const breakMinutes = d.breakMinutes ?? 60;
      const dayWorkHours = calculateDayHours(d.startTime, d.endTime, breakMinutes);
      return {
        id: generateUuidV7(),
        dayOfWeek: d.dayOfWeek,
        startTime: d.startTime,
        endTime: d.endTime,
        breakMinutes,
        dayWorkHours,
      };
    });

    const totalWeeklyHours = parseFloat(
      processedDays.reduce((acc, curr) => acc + curr.dayWorkHours, 0).toFixed(2)
    );

    // Atomic transaction creating Schedule and its days
    return prisma.$transaction(async (tx) => {
      const scheduleId = generateUuidV7();
      const schedule = await tx.workingSchedule.create({
        data: {
          id: scheduleId,
          name,
          code,
          totalWeeklyHours,
          isActive: input.isActive ?? true,
          days: {
            create: processedDays.map((pd) => ({
              id: pd.id,
              dayOfWeek: pd.dayOfWeek,
              startTime: pd.startTime,
              endTime: pd.endTime,
              breakMinutes: pd.breakMinutes,
              dayWorkHours: pd.dayWorkHours,
            })),
          },
        },
        include: {
          days: {
            orderBy: { dayOfWeek: 'asc' },
          },
        },
      });

      return schedule;
    });
  }

  static async listSchedules() {
    return prisma.workingSchedule.findMany({
      orderBy: { name: 'asc' },
      include: {
        days: {
          orderBy: { dayOfWeek: 'asc' },
        },
        _count: {
          select: {
            employees: true,
            contracts: true,
          },
        },
      },
    });
  }

  static async getScheduleById(id: string) {
    const schedule = await prisma.workingSchedule.findUnique({
      where: { id },
      include: {
        days: {
          orderBy: { dayOfWeek: 'asc' },
        },
        _count: {
          select: {
            employees: true,
            contracts: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundError(`Working schedule with ID '${id}' not found`);
    }

    return schedule;
  }

  static async updateSchedule(id: string, input: UpdateScheduleInput) {
    await this.getScheduleById(id);

    return prisma.$transaction(async (tx) => {
      let totalWeeklyHours: number | undefined;

      if (input.days) {
        if (input.days.length === 0) {
          throw new ValidationError('A working schedule must define at least one working day');
        }

        const seenDays = new Set<DayOfWeek>();
        for (const d of input.days) {
          if (seenDays.has(d.dayOfWeek)) {
            throw new ValidationError(`Duplicate day of week '${d.dayOfWeek}' in schedule input`);
          }
          seenDays.add(d.dayOfWeek);
        }

        const processedDays = input.days.map((d) => {
          const breakMinutes = d.breakMinutes ?? 60;
          const dayWorkHours = calculateDayHours(d.startTime, d.endTime, breakMinutes);
          return {
            id: generateUuidV7(),
            dayOfWeek: d.dayOfWeek,
            startTime: d.startTime,
            endTime: d.endTime,
            breakMinutes,
            dayWorkHours,
          };
        });

        totalWeeklyHours = parseFloat(
          processedDays.reduce((acc, curr) => acc + curr.dayWorkHours, 0).toFixed(2)
        );

        // Delete old days and reinsert new ones atomically
        await tx.workingScheduleDay.deleteMany({
          where: { workingScheduleId: id },
        });

        await tx.workingScheduleDay.createMany({
          data: processedDays.map((pd) => ({
            ...pd,
            workingScheduleId: id,
          })),
        });
      }

      const updateData: any = {};
      if (input.name) updateData.name = input.name.trim();
      if (input.code) updateData.code = input.code.trim().toUpperCase();
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      if (totalWeeklyHours !== undefined) updateData.totalWeeklyHours = totalWeeklyHours;

      return tx.workingSchedule.update({
        where: { id },
        data: updateData,
        include: {
          days: {
            orderBy: { dayOfWeek: 'asc' },
          },
        },
      });
    });
  }
}
