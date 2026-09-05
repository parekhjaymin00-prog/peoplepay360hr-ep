import prisma from '../prisma';
import { generateUuidV7 } from '../utils/id';
import { TimeOffUnit, AllocationStatus, TimeOffStatus, DayOfWeek, ContractStatus } from '@prisma/client';
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

function normalizeCalendarDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map((s) => parseInt(s, 10));
  return hours * 60 + minutes;
}

export interface CreateTimeOffTypeInput {
  name: string;
  code: string;
  unit: TimeOffUnit;
  requiresAllocation?: boolean;
  isPaid?: boolean;
  color?: string;
  isActive?: boolean;
}

export interface UpdateTimeOffTypeInput {
  name?: string;
  requiresAllocation?: boolean;
  isPaid?: boolean;
  color?: string;
  isActive?: boolean;
}

export interface CreateAllocationInput {
  employeeId: string;
  timeOffTypeId: string;
  allocatedQuantity: number;
  validFrom: string; // "YYYY-MM-DD"
  validTo: string;   // "YYYY-MM-DD"
  notes?: string;
}

export interface ListAllocationsFilter {
  employeeId?: string;
  timeOffTypeId?: string;
  status?: AllocationStatus;
}

export interface CreateTimeOffRequestInput {
  employeeId?: string; // Optional if provided by HR; defaults to self if not provided
  timeOffTypeId: string;
  startDate: string;   // "YYYY-MM-DD"
  endDate: string;     // "YYYY-MM-DD"
  startTime?: string | null; // "HH:mm"
  endTime?: string | null;   // "HH:mm"
  reason?: string;
  status?: TimeOffStatus;    // Default: SUBMITTED
}

export interface ListRequestsFilter {
  employeeId?: string;
  timeOffTypeId?: string;
  status?: TimeOffStatus;
  startDate?: string;
  endDate?: string;
}

export class TimeOffService {
  // ==========================================================================
  // 1. TIME OFF TYPES
  // ==========================================================================

  static async listTypes(includeInactive = false) {
    return prisma.timeOffType.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  static async getTypeById(id: string) {
    const type = await prisma.timeOffType.findUnique({
      where: { id },
    });

    if (!type) {
      throw new NotFoundError(`Time off type '${id}' not found`);
    }

    return type;
  }

  static async createType(input: CreateTimeOffTypeInput) {
    const name = input.name.trim();
    const code = input.code.trim().toUpperCase();

    if (!name) throw new ValidationError('Time off type name is required');
    if (!code) throw new ValidationError('Time off type code is required');

    const existingCode = await prisma.timeOffType.findUnique({ where: { code } });
    if (existingCode) {
      throw new ValidationError(`Time off type code '${code}' is already in use`);
    }

    const existingName = await prisma.timeOffType.findUnique({ where: { name } });
    if (existingName) {
      throw new ValidationError(`Time off type name '${name}' is already in use`);
    }

    return prisma.timeOffType.create({
      data: {
        id: generateUuidV7(),
        name,
        code,
        unit: input.unit,
        requiresAllocation: input.requiresAllocation ?? true,
        isPaid: input.isPaid ?? true,
        color: input.color ?? '#3B82F6',
        isActive: input.isActive ?? true,
      },
    });
  }

  static async updateType(id: string, input: UpdateTimeOffTypeInput) {
    const existing = await this.getTypeById(id);

    if (input.name && input.name.trim() !== existing.name) {
      const name = input.name.trim();
      const duplicate = await prisma.timeOffType.findUnique({ where: { name } });
      if (duplicate && duplicate.id !== id) {
        throw new ValidationError(`Time off type name '${name}' is already in use`);
      }
    }

    return prisma.timeOffType.update({
      where: { id },
      data: {
        name: input.name ? input.name.trim() : undefined,
        requiresAllocation: input.requiresAllocation,
        isPaid: input.isPaid,
        color: input.color,
        isActive: input.isActive,
      },
    });
  }

  // ==========================================================================
  // 2. WORKING SCHEDULE & DURATION CALCULATION
  // ==========================================================================

  /**
   * Resolves the employee's applicable working schedule for a target date.
   */
  static async resolveWorkingSchedule(employeeId: string, targetDate: Date) {
    const contract = await prisma.contract.findFirst({
      where: {
        employeeId,
        status: ContractStatus.ACTIVE,
        startDate: { lte: targetDate },
        OR: [{ endDate: null }, { endDate: { gte: targetDate } }],
      },
      include: {
        workingSchedule: {
          include: { days: true },
        },
      },
    });

    if (contract?.workingSchedule) {
      return contract.workingSchedule;
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        workingSchedule: {
          include: { days: true },
        },
      },
    });

    if (!employee?.workingSchedule) {
      throw new BusinessRuleError('Employee does not have an assigned working schedule', 'NO_SCHEDULE_FOUND');
    }

    return employee.workingSchedule;
  }

  /**
   * Authoritatively computes duration based on the unit and working schedule.
   * Days: count only scheduled working days.
   * Hours: validate time interval falls inside shift hours and compute fractional hours.
   */
  static async calculateDuration(
    employeeId: string,
    timeOffType: { unit: TimeOffUnit },
    startDate: Date,
    endDate: Date,
    startTime?: string | null,
    endTime?: string | null
  ): Promise<number> {
    const schedule = await this.resolveWorkingSchedule(employeeId, startDate);

    if (timeOffType.unit === TimeOffUnit.DAYS) {
      if (startTime !== null && startTime !== undefined) {
        throw new ValidationError('startTime must be null for DAYS time off requests');
      }
      if (endTime !== null && endTime !== undefined) {
        throw new ValidationError('endTime must be null for DAYS time off requests');
      }

      let workingDaysCount = 0;
      const curr = new Date(startDate);

      while (curr <= endDate) {
        const dayOfWeek = DAY_OF_WEEK_MAP[curr.getUTCDay()];
        const isScheduled = schedule.days.some((d) => d.dayOfWeek === dayOfWeek);
        if (isScheduled) {
          workingDaysCount += 1.0;
        }
        curr.setUTCDate(curr.getUTCDate() + 1);
      }

      if (workingDaysCount === 0) {
        throw new BusinessRuleError(
          'The requested leave interval contains no scheduled working days',
          'NO_WORKING_DAYS'
        );
      }

      return workingDaysCount;
    } else {
      // HOURS request
      if (!startTime || !startTime.trim()) {
        throw new ValidationError('startTime is required for HOURS time off requests');
      }
      if (!endTime || !endTime.trim()) {
        throw new ValidationError('endTime is required for HOURS time off requests');
      }

      const st = startTime.trim();
      const et = endTime.trim();

      if (et <= st) {
        throw new BusinessRuleError('endTime must be strictly greater than startTime', 'INVALID_TIME_INTERVAL');
      }

      // Check if start date is a scheduled working day
      const dayOfWeek = DAY_OF_WEEK_MAP[startDate.getUTCDay()];
      const scheduleDay = schedule.days.find((d) => d.dayOfWeek === dayOfWeek);

      if (!scheduleDay) {
        throw new BusinessRuleError('Cannot request hourly leave on a non-working day', 'NOT_A_WORKING_DAY');
      }

      const startMinutes = parseTimeToMinutes(st);
      const endMinutes = parseTimeToMinutes(et);
      const shiftStart = parseTimeToMinutes(scheduleDay.startTime);
      const shiftEnd = parseTimeToMinutes(scheduleDay.endTime);

      if (startMinutes < shiftStart || endMinutes > shiftEnd) {
        throw new BusinessRuleError(
          `Requested hourly leave [${st}-${et}] is outside scheduled shift hours [${scheduleDay.startTime}-${scheduleDay.endTime}]`,
          'OUTSIDE_SHIFT_HOURS'
        );
      }

      const durationHours = parseFloat(((endMinutes - startMinutes) / 60).toFixed(2));
      if (durationHours <= 0) {
        throw new BusinessRuleError('Calculated duration must be greater than 0', 'INVALID_DURATION');
      }

      return durationHours;
    }
  }

  // ==========================================================================
  // 3. ALLOCATIONS
  // ==========================================================================

  static async listAllocations(filter: ListAllocationsFilter, requestingUser: SafeUser) {
    const where: any = {};

    const canReadAll =
      requestingUser.permissions.includes('timeoff.allocation.manage') ||
      requestingUser.role.code === 'ADMIN';

    if (!canReadAll) {
      if (!requestingUser.employee) {
        throw new AuthorizationError('You do not have access to leave allocations');
      }
      where.employeeId = requestingUser.employee.id;
    } else if (filter.employeeId) {
      where.employeeId = filter.employeeId;
    }

    if (filter.timeOffTypeId) where.timeOffTypeId = filter.timeOffTypeId;
    if (filter.status) where.status = filter.status;

    return prisma.timeOffAllocation.findMany({
      where,
      orderBy: { validFrom: 'desc' },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true },
        },
        timeOffType: true,
        approvedBy: {
          select: { id: true, email: true },
        },
      },
    });
  }

  static async getAllocationById(id: string, requestingUser: SafeUser) {
    const alloc = await prisma.timeOffAllocation.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true },
        },
        timeOffType: true,
        approvedBy: {
          select: { id: true, email: true },
        },
      },
    });

    if (!alloc) {
      throw new NotFoundError(`Time off allocation '${id}' not found`);
    }

    const isSelf = requestingUser.employee?.id === alloc.employeeId;
    const canReadAll =
      requestingUser.permissions.includes('timeoff.allocation.manage') ||
      requestingUser.role.code === 'ADMIN';

    if (!canReadAll && !isSelf) {
      throw new AuthorizationError('You do not have permission to view this allocation');
    }

    return alloc;
  }

  static async createAllocation(input: CreateAllocationInput, creatorUserId: string) {
    const employee = await prisma.employee.findUnique({ where: { id: input.employeeId } });
    if (!employee) throw new NotFoundError(`Employee '${input.employeeId}' not found`);

    const type = await this.getTypeById(input.timeOffTypeId);
    if (!type.requiresAllocation) {
      throw new BusinessRuleError(
        `Time off type '${type.name}' does not require allocations`,
        'ALLOCATION_NOT_REQUIRED'
      );
    }

    const validFrom = normalizeCalendarDate(new Date(input.validFrom));
    const validTo = normalizeCalendarDate(new Date(input.validTo));

    if (validFrom > validTo) {
      throw new BusinessRuleError('validFrom must be before or equal to validTo', 'INVALID_VALIDITY_PERIOD');
    }

    if (input.allocatedQuantity <= 0) {
      throw new BusinessRuleError('allocatedQuantity must be strictly greater than 0', 'INVALID_ALLOCATED_QUANTITY');
    }

    const allocationNumber = `ALC-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

    return prisma.timeOffAllocation.create({
      data: {
        id: generateUuidV7(),
        allocationNumber,
        employeeId: input.employeeId,
        timeOffTypeId: input.timeOffTypeId,
        allocatedQuantity: input.allocatedQuantity,
        takenQuantity: 0.0,
        remainingQuantity: input.allocatedQuantity,
        validFrom,
        validTo,
        status: AllocationStatus.DRAFT,
        notes: input.notes?.trim() || null,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        timeOffType: true,
      },
    });
  }

  static async approveAllocation(id: string, approvingUserId: string) {
    const alloc = await prisma.timeOffAllocation.findUnique({ where: { id } });
    if (!alloc) throw new NotFoundError(`Allocation '${id}' not found`);

    if (alloc.status === AllocationStatus.APPROVED) {
      throw new BusinessRuleError('Allocation is already approved', 'ALREADY_APPROVED');
    }

    return prisma.timeOffAllocation.update({
      where: { id },
      data: {
        status: AllocationStatus.APPROVED,
        approvedById: approvingUserId,
        approvedAt: new Date(),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        timeOffType: true,
        approvedBy: { select: { id: true, email: true } },
      },
    });
  }

  // ==========================================================================
  // 4. LEAVE REQUESTS
  // ==========================================================================

  static async listRequests(filter: ListRequestsFilter, requestingUser: SafeUser) {
    const where: any = {};

    const canReadAll =
      requestingUser.permissions.includes('timeoff.request.read') ||
      requestingUser.permissions.includes('timeoff.request.approve') ||
      requestingUser.role.code === 'ADMIN';

    if (!canReadAll) {
      if (!requestingUser.employee) {
        throw new AuthorizationError('You do not have access to leave requests');
      }
      where.employeeId = requestingUser.employee.id;
    } else if (filter.employeeId) {
      where.employeeId = filter.employeeId;
    }

    if (filter.timeOffTypeId) where.timeOffTypeId = filter.timeOffTypeId;
    if (filter.status) where.status = filter.status;

    if (filter.startDate || filter.endDate) {
      if (filter.startDate && filter.endDate) {
        where.startDate = { lte: new Date(filter.endDate) };
        where.endDate = { gte: new Date(filter.startDate) };
      } else if (filter.startDate) {
        where.endDate = { gte: new Date(filter.startDate) };
      } else if (filter.endDate) {
        where.startDate = { lte: new Date(filter.endDate) };
      }
    }

    return prisma.timeOffRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true },
        },
        timeOffType: true,
        allocation: true,
        approvedBy: {
          select: { id: true, email: true },
        },
      },
    });
  }

  static async getRequestById(id: string, requestingUser: SafeUser) {
    const request = await prisma.timeOffRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true },
        },
        timeOffType: true,
        allocation: true,
        approvedBy: {
          select: { id: true, email: true },
        },
      },
    });

    if (!request) {
      throw new NotFoundError(`Time off request '${id}' not found`);
    }

    const isSelf = requestingUser.employee?.id === request.employeeId;
    const canReadAll =
      requestingUser.permissions.includes('timeoff.request.read') ||
      requestingUser.permissions.includes('timeoff.request.approve') ||
      requestingUser.role.code === 'ADMIN';

    if (!canReadAll && !isSelf) {
      throw new AuthorizationError('You do not have permission to view this leave request');
    }

    return request;
  }

  static async createRequest(input: CreateTimeOffRequestInput, requestingUser: SafeUser) {
    // Resolve target employee ID
    let employeeId: string;
    const isHrOrAdmin =
      requestingUser.permissions.includes('timeoff.request.approve') ||
      requestingUser.role.code === 'ADMIN';

    if (input.employeeId && isHrOrAdmin) {
      employeeId = input.employeeId;
    } else {
      if (!requestingUser.employee) {
        throw new AuthorizationError('Authenticated user is not linked to an employee record');
      }
      employeeId = requestingUser.employee.id;
    }

    const type = await this.getTypeById(input.timeOffTypeId);
    const startDate = normalizeCalendarDate(new Date(input.startDate));
    const endDate = normalizeCalendarDate(new Date(input.endDate));

    if (startDate > endDate) {
      throw new BusinessRuleError('startDate must be before or equal to endDate', 'INVALID_DATE_RANGE');
    }

    // Calculate duration authoritatively
    const duration = await this.calculateDuration(
      employeeId,
      type,
      startDate,
      endDate,
      input.startTime,
      input.endTime
    );

    let resolvedAllocationId: string | null = null;

    // Resolve usable allocation if required
    if (type.requiresAllocation) {
      const allocation = await prisma.timeOffAllocation.findFirst({
        where: {
          employeeId,
          timeOffTypeId: type.id,
          status: AllocationStatus.APPROVED,
          validFrom: { lte: startDate },
          validTo: { gte: endDate },
          remainingQuantity: { gte: duration },
        },
        orderBy: { validFrom: 'asc' },
      });

      if (!allocation) {
        throw new BusinessRuleError(
          `No approved allocation with sufficient balance (${duration} ${type.unit.toLowerCase()}) found for the requested period`,
          'INSUFFICIENT_BALANCE'
        );
      }

      resolvedAllocationId = allocation.id;
    }

    const requestNumber = `REQ-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

    return prisma.timeOffRequest.create({
      data: {
        id: generateUuidV7(),
        requestNumber,
        employeeId,
        timeOffTypeId: type.id,
        allocationId: resolvedAllocationId,
        startDate,
        endDate,
        startTime: type.unit === TimeOffUnit.HOURS ? input.startTime?.trim() || null : null,
        endTime: type.unit === TimeOffUnit.HOURS ? input.endTime?.trim() || null : null,
        durationQuantity: duration,
        reason: input.reason?.trim() || null,
        status: input.status ?? TimeOffStatus.SUBMITTED,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        timeOffType: true,
        allocation: true,
      },
    });
  }

  static async submitRequest(id: string, requestingUser: SafeUser) {
    const request = await this.getRequestById(id, requestingUser);

    if (request.status !== TimeOffStatus.DRAFT) {
      throw new BusinessRuleError(
        `Cannot submit request in '${request.status}' status. Only DRAFT requests can be submitted.`,
        'INVALID_REQUEST_STATUS'
      );
    }

    return prisma.timeOffRequest.update({
      where: { id },
      data: { status: TimeOffStatus.SUBMITTED },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        timeOffType: true,
        allocation: true,
      },
    });
  }

  /**
   * Approves leave request atomically:
   * - Validates authorization (user cannot approve own request unless Admin).
   * - Checks overlapping approved leaves.
   * - Row-locks allocation with SELECT FOR UPDATE to eliminate concurrent overdraws.
   * - Deducts balance and updates request status.
   */
  static async approveRequest(id: string, approvingUser: SafeUser) {
    const hasApprovePerm =
      approvingUser.permissions.includes('timeoff.request.approve') ||
      approvingUser.role.code === 'ADMIN';

    if (!hasApprovePerm) {
      throw new AuthorizationError('You do not have permission to approve time off requests');
    }

    // Check if employee is trying to approve their own request without Admin override
    const req = await prisma.timeOffRequest.findUnique({
      where: { id },
      include: { timeOffType: true },
    });

    if (!req) throw new NotFoundError(`Time off request '${id}' not found`);

    if (approvingUser.role.code !== 'ADMIN' && approvingUser.employee?.id === req.employeeId) {
      throw new AuthorizationError('Employees cannot approve their own leave requests');
    }

    if (req.status === TimeOffStatus.APPROVED) {
      throw new BusinessRuleError('Request is already approved', 'ALREADY_APPROVED');
    }

    if (req.status === TimeOffStatus.REFUSED || req.status === TimeOffStatus.CANCELLED) {
      throw new BusinessRuleError(
        `Cannot approve request in '${req.status}' status`,
        'INVALID_REQUEST_STATUS'
      );
    }

    return prisma.$transaction(async (tx) => {
      // 1. Check for overlapping approved leaves
      const existingApproved = await tx.timeOffRequest.findMany({
        where: {
          employeeId: req.employeeId,
          status: TimeOffStatus.APPROVED,
          startDate: { lte: req.endDate },
          endDate: { gte: req.startDate },
        },
      });

      for (const existing of existingApproved) {
        if (existing.id === req.id) continue;

        // If both are hourly on the same calendar day
        if (
          req.timeOffType.unit === TimeOffUnit.HOURS &&
          existing.startTime &&
          existing.endTime &&
          req.startTime &&
          req.endTime &&
          existing.startDate.toISOString().split('T')[0] === req.startDate.toISOString().split('T')[0]
        ) {
          const s1 = parseTimeToMinutes(req.startTime);
          const e1 = parseTimeToMinutes(req.endTime);
          const s2 = parseTimeToMinutes(existing.startTime);
          const e2 = parseTimeToMinutes(existing.endTime);

          if (s1 < e2 && e1 > s2) {
            throw new BusinessRuleError(
              'Employee already has an approved leave overlapping with this time interval',
              'OVERLAPPING_LEAVE'
            );
          }
        } else {
          // Full-day or overlapping date
          throw new BusinessRuleError(
            'Employee already has an approved leave overlapping with this period',
            'OVERLAPPING_LEAVE'
          );
        }
      }

      // 2. Lock and update allocation if required
      if (req.timeOffType.requiresAllocation) {
        if (!req.allocationId) {
          throw new BusinessRuleError(
            'Request requires an approved allocation but none was linked',
            'MISSING_ALLOCATION'
          );
        }

        const locked = await tx.$queryRaw<any[]>`
          SELECT id, "allocatedQuantity", "takenQuantity", "remainingQuantity", status
          FROM "TimeOffAllocation"
          WHERE id = ${req.allocationId}::uuid
          FOR UPDATE
        `;

        if (!locked || locked.length === 0) {
          throw new NotFoundError(`Allocation '${req.allocationId}' not found`);
        }

        const alloc = locked[0];
        if (alloc.status !== AllocationStatus.APPROVED) {
          throw new BusinessRuleError('Allocation is not approved', 'ALLOCATION_NOT_APPROVED');
        }

        const duration = Number(req.durationQuantity);
        const remaining = Number(alloc.remainingQuantity);

        if (remaining < duration) {
          throw new BusinessRuleError(
            `Insufficient allocation balance. Required: ${duration}, Available: ${remaining}`,
            'INSUFFICIENT_BALANCE'
          );
        }

        const newTaken = parseFloat((Number(alloc.takenQuantity) + duration).toFixed(2));
        const newRemaining = parseFloat((remaining - duration).toFixed(2));

        await tx.timeOffAllocation.update({
          where: { id: req.allocationId },
          data: {
            takenQuantity: newTaken,
            remainingQuantity: newRemaining,
          },
        });
      }

      // 3. Mark request as APPROVED
      return tx.timeOffRequest.update({
        where: { id: req.id },
        data: {
          status: TimeOffStatus.APPROVED,
          approvedById: approvingUser.id,
          approvedAt: new Date(),
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
          timeOffType: true,
          allocation: true,
          approvedBy: { select: { id: true, email: true } },
        },
      });
    });
  }

  static async refuseRequest(id: string, refusalReason: string, refusingUser: SafeUser) {
    const hasApprovePerm =
      refusingUser.permissions.includes('timeoff.request.approve') ||
      refusingUser.role.code === 'ADMIN';

    if (!hasApprovePerm) {
      throw new AuthorizationError('You do not have permission to refuse time off requests');
    }

    const request = await prisma.timeOffRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundError(`Time off request '${id}' not found`);

    if (request.status === TimeOffStatus.APPROVED) {
      throw new BusinessRuleError('Approved requests cannot be refused. They must be cancelled.', 'CANNOT_REFUSE_APPROVED');
    }

    const reason = refusalReason?.trim();
    if (!reason) {
      throw new ValidationError('A refusal reason is required when refusing a leave request');
    }

    return prisma.timeOffRequest.update({
      where: { id },
      data: {
        status: TimeOffStatus.REFUSED,
        refusalReason: reason,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        timeOffType: true,
      },
    });
  }

  /**
   * Cancels an APPROVED request and transactionally restores consumed allocation balance.
   */
  static async cancelRequest(id: string, cancellingUser: SafeUser) {
    const request = await prisma.timeOffRequest.findUnique({
      where: { id },
      include: { timeOffType: true },
    });

    if (!request) throw new NotFoundError(`Time off request '${id}' not found`);

    const isSelf = cancellingUser.employee?.id === request.employeeId;
    const canManage =
      cancellingUser.permissions.includes('timeoff.request.approve') ||
      cancellingUser.role.code === 'ADMIN';

    if (!isSelf && !canManage) {
      throw new AuthorizationError('You do not have permission to cancel this leave request');
    }

    if (request.status !== TimeOffStatus.APPROVED) {
      throw new BusinessRuleError(
        `Only APPROVED requests can be cancelled. Current status: '${request.status}'`,
        'INVALID_REQUEST_STATUS'
      );
    }

    return prisma.$transaction(async (tx) => {
      if (request.allocationId) {
        const locked = await tx.$queryRaw<any[]>`
          SELECT id, "allocatedQuantity", "takenQuantity", "remainingQuantity"
          FROM "TimeOffAllocation"
          WHERE id = ${request.allocationId}::uuid
          FOR UPDATE
        `;

        if (locked && locked.length > 0) {
          const alloc = locked[0];
          const duration = Number(request.durationQuantity);
          const newTaken = Math.max(0, parseFloat((Number(alloc.takenQuantity) - duration).toFixed(2)));
          const newRemaining = Math.min(
            Number(alloc.allocatedQuantity),
            parseFloat((Number(alloc.remainingQuantity) + duration).toFixed(2))
          );

          await tx.timeOffAllocation.update({
            where: { id: request.allocationId },
            data: {
              takenQuantity: newTaken,
              remainingQuantity: newRemaining,
            },
          });
        }
      }

      return tx.timeOffRequest.update({
        where: { id },
        data: {
          status: TimeOffStatus.CANCELLED,
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
          timeOffType: true,
          allocation: true,
        },
      });
    });
  }

  // ==========================================================================
  // 5. PAYROLL INTEGRATION PREPARATION
  // ==========================================================================

  /**
   * Exposes reliable query method for subsequent Payroll phases.
   * Derives total paid and unpaid leave duration for an employee across a pay period.
   */
  static async getApprovedLeaveSummaryForPeriod(employeeId: string, startDate: Date, endDate: Date) {
    const requests = await prisma.timeOffRequest.findMany({
      where: {
        employeeId,
        status: TimeOffStatus.APPROVED,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: {
        timeOffType: true,
      },
    });

    let paidDays = 0;
    let unpaidDays = 0;
    let paidHours = 0;
    let unpaidHours = 0;

    const details = requests.map((req) => {
      const dur = Number(req.durationQuantity);
      if (req.timeOffType.unit === TimeOffUnit.DAYS) {
        if (req.timeOffType.isPaid) paidDays += dur;
        else unpaidDays += dur;
      } else {
        if (req.timeOffType.isPaid) paidHours += dur;
        else unpaidHours += dur;
      }

      return {
        requestId: req.id,
        typeName: req.timeOffType.name,
        isPaid: req.timeOffType.isPaid,
        unit: req.timeOffType.unit,
        duration: dur,
        startDate: req.startDate,
        endDate: req.endDate,
      };
    });

    return {
      paidDays: parseFloat(paidDays.toFixed(2)),
      unpaidDays: parseFloat(unpaidDays.toFixed(2)),
      paidHours: parseFloat(paidHours.toFixed(2)),
      unpaidHours: parseFloat(unpaidHours.toFixed(2)),
      details,
    };
  }
}
