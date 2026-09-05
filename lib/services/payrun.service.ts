import prisma from '../prisma';
import { generateUuidV7 } from '../utils/id';
import { PayrunStatus, PayslipStatus, Prisma } from '@prisma/client';
import { SafeUser } from '../auth/types';
import { ValidationError, NotFoundError, BusinessRuleError, AuthorizationError } from '../errors';
import { PayrollEngine } from '../payroll/payroll-engine';

function normalizeCalendarDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export interface CreatePayrunInput {
  name: string;
  salaryStructureId: string;
  periodStartDate: string; // "YYYY-MM-DD"
  periodEndDate: string;   // "YYYY-MM-DD"
  employeeIds: string[];
  notes?: string;
}

export interface ListPayrunsFilter {
  status?: PayrunStatus;
  startDate?: string;
  endDate?: string;
  salaryStructureId?: string;
}

export class PayrunService {
  /**
   * Lists all payruns with optional status and period filtering.
   */
  static async listPayruns(filter?: ListPayrunsFilter) {
    const where: any = {};
    if (filter?.status) where.status = filter.status;
    if (filter?.salaryStructureId) where.salaryStructureId = filter.salaryStructureId;
    if (filter?.startDate || filter?.endDate) {
      if (filter.startDate) where.periodStartDate = { gte: new Date(filter.startDate) };
      if (filter.endDate) where.periodEndDate = { lte: new Date(filter.endDate) };
    }

    return prisma.payrun.findMany({
      where,
      orderBy: { periodStartDate: 'desc' },
      include: {
        salaryStructure: { select: { id: true, name: true, code: true } },
        validatedBy: { select: { id: true, email: true } },
        paidBy: { select: { id: true, email: true } },
        _count: { select: { payslips: true, payrunEmployees: true } },
      },
    });
  }

  /**
   * Retrieves single payrun by ID with details.
   */
  static async getPayrunById(id: string) {
    const payrun = await prisma.payrun.findUnique({
      where: { id },
      include: {
        salaryStructure: true,
        payrunEmployees: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
            contract: true,
          },
        },
        validatedBy: { select: { id: true, email: true } },
        paidBy: { select: { id: true, email: true } },
      },
    });

    if (!payrun) {
      throw new NotFoundError(`Payrun '${id}' not found`);
    }

    return payrun;
  }

  /**
   * Creates a new Payrun in DRAFT status, validates contract eligibility, and freezes PayrunEmployee.contractId.
   */
  static async createPayrun(input: CreatePayrunInput, creatorUser: SafeUser) {
    const name = input.name?.trim();
    if (!name) throw new ValidationError('Payrun name is required');

    const periodStart = normalizeCalendarDate(new Date(input.periodStartDate));
    const periodEnd = normalizeCalendarDate(new Date(input.periodEndDate));

    if (periodStart > periodEnd) {
      throw new BusinessRuleError(
        'Payrun period start date must be before or equal to period end date',
        'INVALID_PERIOD'
      );
    }

    if (!input.employeeIds || input.employeeIds.length === 0) {
      throw new ValidationError('At least one employee must be selected for the payrun');
    }

    // Verify salary structure exists and is active
    const structure = await prisma.salaryStructure.findUnique({
      where: { id: input.salaryStructureId },
    });
    if (!structure) throw new NotFoundError(`Salary structure '${input.salaryStructureId}' not found`);
    if (!structure.isActive) {
      throw new BusinessRuleError(
        `Salary structure '${structure.name}' is inactive and cannot be used for payroll`,
        'INACTIVE_SALARY_STRUCTURE'
      );
    }

    // For every employee, check duplicate overlapping payruns and resolve contract
    const eligiblePayrunEmployees: Array<{ employeeId: string; contractId: string }> = [];

    for (const empId of input.employeeIds) {
      // Duplicate overlapping payroll check
      const overlapping = await prisma.payrunEmployee.findFirst({
        where: {
          employeeId: empId,
          payrun: {
            status: { not: PayrunStatus.CANCELLED },
            periodStartDate: { lte: periodEnd },
            periodEndDate: { gte: periodStart },
          },
        },
        include: { payrun: true },
      });

      if (overlapping) {
        throw new BusinessRuleError(
          `Employee already has a payrun ('${overlapping.payrun.reference}') covering overlapping dates`,
          'DUPLICATE_PAYROLL_PERIOD'
        );
      }

      // Contract resolution (must have exactly 1 active covering contract)
      const { contract, warnings } = await PayrollEngine.resolveEligibleContract(
        empId,
        periodStart,
        periodEnd
      );

      const blockingWarning = warnings.find((w) => w.isBlocking);
      if (blockingWarning || !contract) {
        throw new BusinessRuleError(
          `Employee is ineligible for payroll: ${blockingWarning?.message || 'No eligible contract'}`,
          blockingWarning?.code || 'MISSING_ACTIVE_CONTRACT'
        );
      }

      eligiblePayrunEmployees.push({
        employeeId: empId,
        contractId: contract.id,
      });
    }

    const reference = `PR-${periodStart.getUTCFullYear()}${(periodStart.getUTCMonth() + 1).toString().padStart(2, '0')}-${Math.floor(Math.random() * 90000 + 10000)}`;

    return prisma.$transaction(async (tx) => {
      const payrun = await tx.payrun.create({
        data: {
          id: generateUuidV7(),
          name,
          reference,
          salaryStructureId: input.salaryStructureId,
          periodStartDate: periodStart,
          periodEndDate: periodEnd,
          status: PayrunStatus.DRAFT,
          notes: input.notes?.trim() || null,
        },
      });

      // Insert frozen PayrunEmployee records
      for (const item of eligiblePayrunEmployees) {
        await tx.payrunEmployee.create({
          data: {
            id: generateUuidV7(),
            payrunId: payrun.id,
            employeeId: item.employeeId,
            contractId: item.contractId, // Authoritative frozen contract
          },
        });
      }

      return payrun;
    });
  }

  /**
   * Computes authoritative payslips and payslip lines for all PayrunEmployees.
   * State transition: DRAFT -> COMPUTED.
   * Row-locks payrun to prevent concurrent execution.
   */
  static async computePayrun(payrunId: string, user: SafeUser) {
    return prisma.$transaction(async (tx) => {
      // 1. Lock payrun row
      const [lockedPayrun] = await tx.$queryRaw<any[]>`
        SELECT id, name, reference, status, "salaryStructureId", "periodStartDate", "periodEndDate"
        FROM "Payrun"
        WHERE id = ${payrunId}::uuid
        FOR UPDATE
      `;

      if (!lockedPayrun) {
        throw new NotFoundError(`Payrun '${payrunId}' not found`);
      }

      if (
        lockedPayrun.status === PayrunStatus.VALIDATED ||
        lockedPayrun.status === PayrunStatus.PAID
      ) {
        throw new BusinessRuleError(
          `Finalized payrun in '${lockedPayrun.status}' status cannot be modified or recalculated`,
          'PAYRUN_LOCKED'
        );
      }

      // Clean up any previously computed payslips for this payrun (idempotency guarantee)
      await tx.payslip.deleteMany({
        where: { payrunId },
      });

      // Load all frozen PayrunEmployees
      const payrunEmployees = await tx.payrunEmployee.findMany({
        where: { payrunId },
      });

      if (payrunEmployees.length === 0) {
        throw new BusinessRuleError('Payrun has no enrolled employees', 'NO_EMPLOYEES');
      }

      let totalGross = 0.0;
      let totalDeductions = 0.0;
      let totalNet = 0.0;
      let totalEmployerCost = 0.0;
      let warningCount = 0;

      const periodStart = new Date(lockedPayrun.periodStartDate);
      const periodEnd = new Date(lockedPayrun.periodEndDate);

      // 2. Compute each employee's payslip
      for (const pe of payrunEmployees) {
        const result = await PayrollEngine.computeEmployeePayslip(
          pe.employeeId,
          pe.contractId, // Uses frozen contractId!
          lockedPayrun.salaryStructureId,
          periodStart,
          periodEnd
        );

        if (result.hasWarnings) {
          warningCount++;
        }

        const payslipNumber = `PS-${lockedPayrun.reference.replace('PR-', '')}-${result.employee.employeeNumber}`;

        const payslip = await tx.payslip.create({
          data: {
            id: generateUuidV7(),
            payslipNumber,
            payrunId,
            employeeId: pe.employeeId,
            contractId: pe.contractId,
            salaryStructureId: lockedPayrun.salaryStructureId,
            periodStartDate: periodStart,
            periodEndDate: periodEnd,
            status: PayslipStatus.COMPUTED,

            // Document Reproducibility Snapshots
            employeeNumberSnapshot: result.employee.employeeNumber,
            employeeNameSnapshot: `${result.employee.firstName} ${result.employee.lastName}`,
            contractNumberSnapshot: result.contract.contractNumber,
            contractWageSnapshot: result.contract.wage,
            contractWageTypeSnapshot: result.contract.wageType,
            salaryStructureNameSnapshot: result.salaryStructure.name,
            departmentIdSnapshot: result.employee.departmentId,
            departmentNameSnapshot: result.employee.department?.name || 'Unassigned',
            jobPositionIdSnapshot: result.employee.jobPositionId,
            jobPositionNameSnapshot: result.employee.jobPosition?.title || 'Unassigned',

            // Attendance & Leave Metrics Snapshot
            scheduledWorkingDays: result.metrics.scheduledWorkingDays,
            actualWorkedDays: result.metrics.actualWorkedDays,
            paidLeaveQuantity: result.metrics.paidLeaveQuantity,
            unpaidLeaveQuantity: result.metrics.unpaidLeaveQuantity,
            absentDays: result.metrics.absentDays,
            workedHours: result.metrics.workedHours,
            expectedHours: result.metrics.expectedHours,
            overtimeHours: result.metrics.overtimeHours,

            // Financial Totals
            basicSalary: result.basicSalary,
            grossSalary: result.grossSalary,
            totalDeductions: result.totalDeductions,
            netSalary: result.netSalary,
            totalEmployerCost: result.totalEmployerCost,

            hasWarnings: result.hasWarnings,
            warningsJson: result.warnings.length > 0 ? (result.warnings as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          },
        });

        // Insert PayslipLines
        for (const line of result.lines) {
          await tx.payslipLine.create({
            data: {
              id: generateUuidV7(),
              payslipId: payslip.id,
              salaryRuleId: line.salaryRuleId,
              ruleCode: line.ruleCode,
              ruleName: line.ruleName,
              category: line.category,
              sequence: line.sequence,
              rate: line.rate,
              baseAmount: line.baseAmount,
              amount: line.amount,
              formulaSnapshot: line.formulaSnapshot,
            },
          });
        }

        totalGross += result.grossSalary;
        totalDeductions += result.totalDeductions;
        totalNet += result.netSalary;
        totalEmployerCost += result.totalEmployerCost;
      }

      // 3. Update Payrun aggregate totals and set COMPUTED
      return tx.payrun.update({
        where: { id: payrunId },
        data: {
          status: PayrunStatus.COMPUTED,
          totalGross: parseFloat(totalGross.toFixed(2)),
          totalDeductions: parseFloat(totalDeductions.toFixed(2)),
          totalNet: parseFloat(totalNet.toFixed(2)),
          totalEmployerCost: parseFloat(totalEmployerCost.toFixed(2)),
          payslipCount: payrunEmployees.length,
          warningCount,
        },
        include: {
          salaryStructure: true,
          payslips: {
            include: { lines: true },
          },
        },
      });
    });
  }

  /**
   * Validates a computed payrun and locks it against further changes.
   * State transition: COMPUTED -> VALIDATED.
   * Strict: rejects if any blocking warnings are present.
   */
  static async validatePayrun(payrunId: string, user: SafeUser) {
    const payrun = await this.getPayrunById(payrunId);

    if (payrun.status !== PayrunStatus.COMPUTED) {
      throw new BusinessRuleError(
        `Only COMPUTED payruns can be validated. Current status: '${payrun.status}'`,
        'INVALID_PAYRUN_STATUS'
      );
    }

    // Inspect payslips for any blocking warnings
    const payslips = await prisma.payslip.findMany({
      where: { payrunId },
    });

    for (const ps of payslips) {
      if (ps.hasWarnings && ps.warningsJson) {
        const warnings = ps.warningsJson as any[];
        const hasBlocking = Array.isArray(warnings) && warnings.some((w) => w.isBlocking);
        if (hasBlocking) {
          throw new BusinessRuleError(
            `Cannot validate payrun: Payslip '${ps.payslipNumber}' has unresolved blocking warnings`,
            'PAYRUN_HAS_BLOCKING_WARNINGS'
          );
        }
      }
    }

    return prisma.$transaction(async (tx) => {
      // Mark all payslips as VALIDATED
      await tx.payslip.updateMany({
        where: { payrunId },
        data: { status: PayslipStatus.VALIDATED },
      });

      return tx.payrun.update({
        where: { id: payrunId },
        data: {
          status: PayrunStatus.VALIDATED,
          validatedById: user.id,
          validatedAt: new Date(),
        },
        include: {
          salaryStructure: true,
          validatedBy: { select: { id: true, email: true } },
        },
      });
    });
  }

  /**
   * Marks a validated payrun as PAID.
   * State transition: VALIDATED -> PAID.
   */
  static async markPayrunPaid(payrunId: string, user: SafeUser) {
    const payrun = await this.getPayrunById(payrunId);

    if (payrun.status !== PayrunStatus.VALIDATED) {
      throw new BusinessRuleError(
        `Only VALIDATED payruns can be marked as PAID. Current status: '${payrun.status}'`,
        'INVALID_PAYRUN_STATUS'
      );
    }

    return prisma.$transaction(async (tx) => {
      // Mark all payslips as PAID
      await tx.payslip.updateMany({
        where: { payrunId },
        data: { status: PayslipStatus.PAID },
      });

      return tx.payrun.update({
        where: { id: payrunId },
        data: {
          status: PayrunStatus.PAID,
          paidById: user.id,
          paidAt: new Date(),
          paymentDate: new Date(),
        },
        include: {
          salaryStructure: true,
          paidBy: { select: { id: true, email: true } },
        },
      });
    });
  }

  /**
   * Lists payslips belonging to a payrun with role-based scoping.
   */
  static async listPayrunPayslips(payrunId: string, user: SafeUser) {
    const where: any = { payrunId };

    const isHrOrAdmin =
      user.role.code === 'ADMIN' ||
      user.permissions.includes('payroll.payrun.read');

    if (!isHrOrAdmin) {
      if (!user.employee) {
        throw new AuthorizationError('You do not have access to payslip records');
      }
      where.employeeId = user.employee.id;
    }

    return prisma.payslip.findMany({
      where,
      orderBy: { employeeNameSnapshot: 'asc' },
      include: {
        lines: { orderBy: { sequence: 'asc' } },
      },
    });
  }

  /**
   * Retrieves single payslip by ID with authorization verification.
   */
  static async getPayslipById(payslipId: string, user: SafeUser) {
    const payslip = await prisma.payslip.findUnique({
      where: { id: payslipId },
      include: {
        lines: { orderBy: { sequence: 'asc' } },
        payrun: { select: { id: true, name: true, reference: true, status: true } },
      },
    });

    if (!payslip) {
      throw new NotFoundError(`Payslip '${payslipId}' not found`);
    }

    const isSelf = user.employee?.id === payslip.employeeId;
    const isHrOrAdmin =
      user.role.code === 'ADMIN' ||
      user.permissions.includes('payroll.payrun.read');

    if (!isHrOrAdmin && !isSelf) {
      throw new AuthorizationError('You do not have permission to view this payslip');
    }

    return payslip;
  }

  /**
   * Lists payslips with self-service employee restrictions and history filtering.
   */
  static async listPayslips(filter: {
    employeeId?: string;
    payrunId?: string;
    status?: PayslipStatus;
    startDate?: string;
    endDate?: string;
  } | undefined, user: SafeUser) {
    const where: any = {};

    const isHrOrAdmin =
      user.role.code === 'ADMIN' ||
      user.permissions.includes('payroll.payrun.read');

    if (!isHrOrAdmin) {
      if (!user.employee) {
        throw new AuthorizationError('You do not have access to payslip records');
      }
      // If employee specifies another employee's ID, reject with AuthorizationError
      if (filter?.employeeId && filter.employeeId !== user.employee.id) {
        throw new AuthorizationError('Employees can only access their own payslip history');
      }
      where.employeeId = user.employee.id;
    } else {
      if (filter?.employeeId) {
        where.employeeId = filter.employeeId;
      }
    }

    if (filter?.payrunId) where.payrunId = filter.payrunId;
    if (filter?.status) where.status = filter.status;
    if (filter?.startDate || filter?.endDate) {
      if (filter.startDate) where.periodStartDate = { gte: new Date(filter.startDate) };
      if (filter.endDate) where.periodEndDate = { lte: new Date(filter.endDate) };
    }

    return prisma.payslip.findMany({
      where,
      orderBy: { periodStartDate: 'desc' },
      include: {
        lines: { orderBy: { sequence: 'asc' } },
        payrun: { select: { id: true, name: true, reference: true, status: true } },
      },
    });
  }
}
