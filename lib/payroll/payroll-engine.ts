import prisma from '../prisma';
import { generateUuidV7 } from '../utils/id';
import {
  WageType,
  SalaryRuleCategory,
  ComputationType,
  DayOfWeek,
  Employee,
  Contract,
  SalaryStructure,
  SalaryRule,
} from '@prisma/client';
import { BusinessRuleError, NotFoundError } from '../errors';
import { SafeFormulaEngine } from './formula-engine';
import { TimeOffService } from '../services/time-off.service';

const DAY_OF_WEEK_MAP: Record<number, DayOfWeek> = {
  0: DayOfWeek.SUNDAY,
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
};

export interface PayrollWarning {
  code: string;
  message: string;
  isBlocking: boolean;
  employeeId?: string;
  ruleCode?: string;
}

export interface PayrollPeriodMetrics {
  scheduledWorkingDays: number;
  actualWorkedDays: number;
  paidLeaveQuantity: number;
  unpaidLeaveQuantity: number;
  absentDays: number;
  workedHours: number;
  expectedHours: number;
  overtimeHours: number;
  scheduledHours: number;
}

export interface CalculatedPayslipLine {
  salaryRuleId: string | null;
  ruleCode: string;
  ruleName: string;
  category: SalaryRuleCategory;
  sequence: number;
  rate: number | null;
  baseAmount: number | null;
  amount: number;
  formulaSnapshot: string | null;
}

export interface CalculatedPayslipResult {
  employee: Employee & { department?: any; jobPosition?: any };
  contract: Contract;
  salaryStructure: SalaryStructure;
  metrics: PayrollPeriodMetrics;
  lines: CalculatedPayslipLine[];
  basicSalary: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  totalEmployerCost: number;
  warnings: PayrollWarning[];
  hasWarnings: boolean;
}

export class PayrollEngine {
  /**
   * Resolves the single valid ACTIVE contract covering the complete payrun period.
   * Enforces: startDate <= periodStart AND (endDate IS NULL OR endDate >= periodEnd).
   * Generates blocking warnings if 0 or >1 contracts found.
   */
  static async resolveEligibleContract(
    employeeId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<{ contract: Contract | null; warnings: PayrollWarning[] }> {
    const warnings: PayrollWarning[] = [];

    // Complete period coverage: startDate <= periodStart AND (endDate IS NULL OR endDate >= periodEnd)
    const coveringContracts = await prisma.contract.findMany({
      where: {
        employeeId,
        status: 'ACTIVE',
        startDate: { lte: periodStart },
        OR: [{ endDate: null }, { endDate: { gte: periodEnd } }],
      },
      include: {
        department: true,
        jobPosition: true,
        workingSchedule: { include: { days: true } },
        salaryStructure: true,
      },
    });

    if (coveringContracts.length === 0) {
      warnings.push({
        code: 'MISSING_ACTIVE_CONTRACT',
        message: 'No active employment contract covers the complete payroll period',
        isBlocking: true,
        employeeId,
      });
      return { contract: null, warnings };
    }

    if (coveringContracts.length > 1) {
      warnings.push({
        code: 'MULTIPLE_ACTIVE_CONTRACTS',
        message: `Multiple active contracts (${coveringContracts.length}) cover the payroll period`,
        isBlocking: true,
        employeeId,
      });
      return { contract: null, warnings };
    }

    return { contract: coveringContracts[0], warnings };
  }

  /**
   * Calculates attendance, leave, and schedule metrics for an employee across the payrun period.
   */
  static async calculatePeriodMetrics(
    employeeId: string,
    workingSchedule: { days: Array<{ dayOfWeek: DayOfWeek; dayWorkHours: any }> },
    periodStart: Date,
    periodEnd: Date
  ): Promise<PayrollPeriodMetrics> {
    const scheduledDaysMap = new Map<DayOfWeek, number>();
    for (const d of workingSchedule.days) {
      scheduledDaysMap.set(d.dayOfWeek, Number(d.dayWorkHours));
    }

    // 1. Calculate scheduled working days and scheduled hours across range
    let scheduledWorkingDays = 0;
    let scheduledHours = 0;
    const curr = new Date(periodStart);

    while (curr <= periodEnd) {
      const dow = DAY_OF_WEEK_MAP[curr.getUTCDay()];
      if (scheduledDaysMap.has(dow)) {
        scheduledWorkingDays += 1.0;
        scheduledHours += scheduledDaysMap.get(dow)!;
      }
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    // 2. Query attendance logs in range
    const attendances = await prisma.attendance.findMany({
      where: {
        employeeId,
        date: { gte: periodStart, lte: periodEnd },
      },
    });

    let workedHours = 0;
    let expectedHours = 0;
    let overtimeHours = 0;
    let actualWorkedDays = 0;

    const attendedDateStrings = new Set<string>();

    for (const att of attendances) {
      const wh = Number(att.workedHours);
      workedHours += wh;
      expectedHours += Number(att.expectedHours);
      overtimeHours += Number(att.overtimeHours);

      if (wh > 0 && att.status !== 'ABSENT') {
        actualWorkedDays += 1;
      }
      attendedDateStrings.add(att.date.toISOString().split('T')[0]);
    }

    // 3. Time Off: approved paid and unpaid leave in period
    const leaveSummary = await TimeOffService.getApprovedLeaveSummaryForPeriod(
      employeeId,
      periodStart,
      periodEnd
    );

    const paidLeaveQuantity = leaveSummary.paidDays + (leaveSummary.paidHours > 0 ? parseFloat((leaveSummary.paidHours / 8).toFixed(2)) : 0);
    const unpaidLeaveQuantity = leaveSummary.unpaidDays + (leaveSummary.unpaidHours > 0 ? parseFloat((leaveSummary.unpaidHours / 8).toFixed(2)) : 0);

    // 4. Derive absent days: scheduled working days with NO attendance and NO approved leave
    let absentDays = 0;
    const scanDate = new Date(periodStart);

    while (scanDate <= periodEnd) {
      const dow = DAY_OF_WEEK_MAP[scanDate.getUTCDay()];
      const dStr = scanDate.toISOString().split('T')[0];

      if (scheduledDaysMap.has(dow) && !attendedDateStrings.has(dStr)) {
        // Check if day is covered by approved leave
        const onLeave = leaveSummary.details.some((l) => {
          const lStart = l.startDate.toISOString().split('T')[0];
          const lEnd = l.endDate.toISOString().split('T')[0];
          return dStr >= lStart && dStr <= lEnd;
        });

        if (!onLeave) {
          absentDays += 1;
        }
      }
      scanDate.setUTCDate(scanDate.getUTCDate() + 1);
    }

    return {
      scheduledWorkingDays: parseFloat(scheduledWorkingDays.toFixed(2)),
      actualWorkedDays: parseFloat(actualWorkedDays.toFixed(2)),
      paidLeaveQuantity: parseFloat(paidLeaveQuantity.toFixed(2)),
      unpaidLeaveQuantity: parseFloat(unpaidLeaveQuantity.toFixed(2)),
      absentDays: parseFloat(absentDays.toFixed(2)),
      workedHours: parseFloat(workedHours.toFixed(2)),
      expectedHours: parseFloat(expectedHours.toFixed(2)),
      overtimeHours: parseFloat(overtimeHours.toFixed(2)),
      scheduledHours: parseFloat(scheduledHours.toFixed(2)),
    };
  }

  /**
   * Computes authoritative payslip for a single employee using the frozen contract.
   */
  static async computeEmployeePayslip(
    employeeId: string,
    contractId: string,
    salaryStructureId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<CalculatedPayslipResult> {
    const warnings: PayrollWarning[] = [];

    // Load employee
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        department: true,
        jobPosition: true,
      },
    });

    if (!employee) throw new NotFoundError(`Employee '${employeeId}' not found`);

    // Load frozen contract
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        department: true,
        jobPosition: true,
        workingSchedule: { include: { days: true } },
        salaryStructure: true,
      },
    });

    if (!contract) throw new NotFoundError(`Frozen contract '${contractId}' not found`);

    // Check bank information warning (non-blocking)
    if (!employee.bankAccountNumber || !employee.bankRoutingCode) {
      warnings.push({
        code: 'MISSING_BANK_DETAILS',
        message: 'Employee bank account or routing details are missing',
        isBlocking: false,
        employeeId,
      });
    }

    // Load salary structure (assigned to contract or override)
    const structure = await prisma.salaryStructure.findUnique({
      where: { id: salaryStructureId },
      include: {
        structureRules: {
          include: { salaryRule: true },
        },
      },
    });

    if (!structure) throw new NotFoundError(`Salary structure '${salaryStructureId}' not found`);

    if (!structure.isActive) {
      warnings.push({
        code: 'INACTIVE_SALARY_STRUCTURE',
        message: `Salary structure '${structure.name}' is inactive`,
        isBlocking: true,
        employeeId,
      });
    }

    // Calculate metrics
    const schedule = contract.workingSchedule;
    const metrics = await this.calculatePeriodMetrics(employeeId, schedule, periodStart, periodEnd);

    // Determine basic wage
    const contractWage = Number(contract.wage);
    let basicAmount = contractWage;

    if (contract.wageType === WageType.HOURLY) {
      basicAmount = parseFloat((contractWage * metrics.workedHours).toFixed(2));
    }

    // Prepare payroll calculation context
    const context: Record<string, number> = {
      BASIC: basicAmount,
      GROSS: basicAmount,
      UNPAID_DAYS: metrics.unpaidLeaveQuantity + metrics.absentDays,
      SCHEDULED_DAYS: metrics.scheduledWorkingDays > 0 ? metrics.scheduledWorkingDays : 1,
      WORKED_DAYS: metrics.actualWorkedDays,
      WORKED_HOURS: metrics.workedHours,
      SCHEDULED_HOURS: metrics.scheduledHours,
      OVERTIME_HOURS: metrics.overtimeHours,
    };

    // Sort structure rules by effectiveSequence ascending
    const orderedRules = structure.structureRules.map((sr) => ({
      id: sr.id,
      salaryRuleId: sr.salaryRuleId,
      sequenceOverride: sr.sequenceOverride,
      effectiveSequence: sr.sequenceOverride !== null && sr.sequenceOverride !== undefined
        ? sr.sequenceOverride
        : sr.salaryRule.sequence,
      rule: sr.salaryRule,
    }));

    orderedRules.sort((a, b) => {
      if (a.effectiveSequence !== b.effectiveSequence) {
        return a.effectiveSequence - b.effectiveSequence;
      }
      return a.rule.id.localeCompare(b.rule.id);
    });

    // Evaluate rules sequentially
    const evaluatedRules: Record<string, number> = {};
    const lines: CalculatedPayslipLine[] = [];

    for (const item of orderedRules) {
      const rule = item.rule;

      if (!rule.isActive) {
        warnings.push({
          code: 'INACTIVE_RULE_SKIPPED',
          message: `Rule '${rule.code}' is inactive and was skipped during calculation`,
          isBlocking: false,
          employeeId,
          ruleCode: rule.code,
        });
        continue;
      }

      try {
        let amount = 0;
        let baseAmount: number | null = null;
        let rate: number | null = null;

        if (rule.code === 'BASIC' || (rule.category === SalaryRuleCategory.BASIC && (rule.fixedAmount === null || Number(rule.fixedAmount) === 0))) {
          amount = basicAmount;
        } else if (rule.computationType === ComputationType.FIXED) {
          amount = Number(rule.fixedAmount);
        } else if (rule.computationType === ComputationType.PERCENTAGE) {
          rate = Number(rule.percentageRate);
          const baseKey = (rule.percentageBaseCode || 'BASIC').toUpperCase();
          baseAmount = evaluatedRules[baseKey] ?? context[baseKey] ?? context.BASIC;
          amount = parseFloat(((baseAmount * rate) / 100.0).toFixed(2));
        } else if (rule.computationType === ComputationType.FORMULA) {
          const merged = { ...context, ...evaluatedRules };
          amount = SafeFormulaEngine.evaluate(rule.formulaExpression!, merged);
        }

        // Amount must be positive magnitude
        amount = Math.max(0, parseFloat(amount.toFixed(2)));

        evaluatedRules[rule.code.toUpperCase()] = amount;

        lines.push({
          salaryRuleId: rule.id,
          ruleCode: rule.code,
          ruleName: rule.name,
          category: rule.category,
          sequence: item.effectiveSequence,
          rate,
          baseAmount,
          amount,
          formulaSnapshot: rule.formulaExpression || null,
        });
      } catch (err: any) {
        warnings.push({
          code: 'RULE_CALCULATION_FAILED',
          message: `Evaluation of rule '${rule.code}' failed: ${err.message}`,
          isBlocking: true,
          employeeId,
          ruleCode: rule.code,
        });
      }
    }

    // Financial Totals aggregation (Positive-magnitude semantics)
    let grossSalary = 0.0;
    let totalDeductions = 0.0;
    let netSalary = 0.0;
    let totalEmployerCost = 0.0;

    let hasExplicitGross = false;
    let hasExplicitNet = false;

    for (const line of lines) {
      if (line.category === SalaryRuleCategory.BASIC || line.category === SalaryRuleCategory.ALLOWANCE) {
        grossSalary += line.amount;
      } else if (line.category === SalaryRuleCategory.GROSS) {
        hasExplicitGross = true;
        grossSalary = line.amount;
      } else if (line.category === SalaryRuleCategory.DEDUCTION) {
        totalDeductions += line.amount;
      } else if (line.category === SalaryRuleCategory.NET) {
        hasExplicitNet = true;
        netSalary = line.amount;
      } else if (line.category === SalaryRuleCategory.COMPANY_CONTRIBUTION) {
        totalEmployerCost += line.amount;
      }
    }

    if (!hasExplicitNet) {
      netSalary = Math.max(0, parseFloat((grossSalary - totalDeductions).toFixed(2)));
    }

    totalEmployerCost = parseFloat((grossSalary + totalEmployerCost).toFixed(2));
    grossSalary = parseFloat(grossSalary.toFixed(2));
    totalDeductions = parseFloat(totalDeductions.toFixed(2));

    return {
      employee,
      contract,
      salaryStructure: structure,
      metrics,
      lines,
      basicSalary: parseFloat(basicAmount.toFixed(2)),
      grossSalary,
      totalDeductions,
      netSalary,
      totalEmployerCost,
      warnings,
      hasWarnings: warnings.length > 0,
    };
  }
}
