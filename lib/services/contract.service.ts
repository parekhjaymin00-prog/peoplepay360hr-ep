import prisma from '../prisma';
import { generateUuidV7 } from '../utils/id';
import { WageType, ContractStatus } from '@prisma/client';
import { ValidationError, NotFoundError, BusinessRuleError } from '../errors';

export interface CreateContractInput {
  contractNumber: string;
  employeeId: string;
  departmentId: string;
  jobPositionId: string;
  workingScheduleId: string;
  salaryStructureId: string;
  wage: number;
  wageType?: WageType;
  startDate: string; // ISO Date "YYYY-MM-DD"
  endDate?: string | null;
  status?: ContractStatus;
  notes?: string | null;
}

export interface UpdateContractInput {
  wage?: number;
  wageType?: WageType;
  startDate?: string;
  endDate?: string | null;
  status?: ContractStatus;
  departmentId?: string;
  jobPositionId?: string;
  workingScheduleId?: string;
  salaryStructureId?: string;
  notes?: string | null;
}

export class ContractService {
  static async createContract(input: CreateContractInput) {
    const contractNumber = input.contractNumber.trim().toUpperCase();

    // Check unique contractNumber
    const existing = await prisma.contract.findUnique({
      where: { contractNumber },
    });
    if (existing) {
      throw new ValidationError(`Contract number '${contractNumber}' already exists`);
    }

    if (input.wage <= 0) {
      throw new ValidationError('Contract wage must be strictly greater than 0');
    }

    const startDate = new Date(input.startDate);
    const endDate = input.endDate ? new Date(input.endDate) : null;

    if (endDate && endDate < startDate) {
      throw new BusinessRuleError('Contract end date cannot be before start date', 'INVALID_CONTRACT_DATES');
    }

    // Verify Employee
    const emp = await prisma.employee.findUnique({ where: { id: input.employeeId } });
    if (!emp) throw new NotFoundError(`Employee '${input.employeeId}' not found`);

    // Verify Department
    const dept = await prisma.department.findUnique({ where: { id: input.departmentId } });
    if (!dept) throw new NotFoundError(`Department '${input.departmentId}' not found`);

    // Verify Job Position
    const job = await prisma.jobPosition.findUnique({ where: { id: input.jobPositionId } });
    if (!job) throw new NotFoundError(`Job Position '${input.jobPositionId}' not found`);

    // Verify Working Schedule
    const schedule = await prisma.workingSchedule.findUnique({ where: { id: input.workingScheduleId } });
    if (!schedule) throw new NotFoundError(`Working Schedule '${input.workingScheduleId}' not found`);

    // Verify Salary Structure
    const structure = await prisma.salaryStructure.findUnique({ where: { id: input.salaryStructureId } });
    if (!structure) throw new NotFoundError(`Salary Structure '${input.salaryStructureId}' not found`);

    return prisma.contract.create({
      data: {
        id: generateUuidV7(),
        contractNumber,
        employeeId: input.employeeId,
        departmentId: input.departmentId,
        jobPositionId: input.jobPositionId,
        workingScheduleId: input.workingScheduleId,
        salaryStructureId: input.salaryStructureId,
        wage: input.wage,
        wageType: input.wageType ?? WageType.MONTHLY,
        startDate,
        endDate,
        status: input.status ?? ContractStatus.DRAFT,
        notes: input.notes ?? null,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        department: { select: { id: true, name: true, code: true } },
        jobPosition: { select: { id: true, title: true, code: true } },
        salaryStructure: { select: { id: true, name: true, code: true } },
      },
    });
  }

  static async getContractById(id: string) {
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true, email: true } },
        department: true,
        jobPosition: true,
        workingSchedule: {
          include: { days: { orderBy: { dayOfWeek: 'asc' } } },
        },
        salaryStructure: {
          include: {
            structureRules: {
              include: { salaryRule: true },
            },
          },
        },
        _count: {
          select: { payslips: true },
        },
      },
    });

    if (!contract) {
      throw new NotFoundError(`Contract with ID '${id}' not found`);
    }

    return contract;
  }

  static async listContractsByEmployeeId(employeeId: string) {
    return prisma.contract.findMany({
      where: { employeeId },
      orderBy: { startDate: 'desc' },
      include: {
        department: { select: { id: true, name: true, code: true } },
        jobPosition: { select: { id: true, title: true, code: true } },
        salaryStructure: { select: { id: true, name: true, code: true } },
      },
    });
  }

  /**
   * Updates an existing contract while strictly enforcing the CONTRACT IMMUTABILITY GUARD.
   */
  static async updateContract(id: string, input: UpdateContractInput) {
    const contract = await this.getContractById(id);

    // Check if contract has finalized/computed payslips
    const referencedPayslipsCount = await prisma.payslip.count({
      where: {
        contractId: id,
        status: { in: ['COMPUTED', 'VALIDATED', 'PAID'] },
      },
    });

    const isReferencedByPayslips = referencedPayslipsCount > 0;

    // Check if immutable fields are being altered
    const payrollCriticalFieldsChanged =
      (input.wage !== undefined && Number(input.wage) !== Number(contract.wage)) ||
      (input.wageType !== undefined && input.wageType !== contract.wageType) ||
      (input.startDate !== undefined && new Date(input.startDate).toISOString() !== contract.startDate.toISOString()) ||
      (input.endDate !== undefined &&
        ((input.endDate === null && contract.endDate !== null) ||
          (input.endDate !== null &&
            (!contract.endDate || new Date(input.endDate).toISOString() !== contract.endDate.toISOString())))) ||
      (input.departmentId !== undefined && input.departmentId !== contract.departmentId) ||
      (input.jobPositionId !== undefined && input.jobPositionId !== contract.jobPositionId) ||
      (input.workingScheduleId !== undefined && input.workingScheduleId !== contract.workingScheduleId) ||
      (input.salaryStructureId !== undefined && input.salaryStructureId !== contract.salaryStructureId);

    if (isReferencedByPayslips && payrollCriticalFieldsChanged) {
      throw new BusinessRuleError(
        `Contract '${contract.contractNumber}' is referenced by ${referencedPayslipsCount} computed or finalized payslips and its payroll terms are strictly immutable. To alter terms, create a new contract.`,
        'CONTRACT_IMMUTABLE'
      );
    }

    if (input.wage !== undefined && input.wage <= 0) {
      throw new ValidationError('Contract wage must be strictly greater than 0');
    }

    const data: any = {};
    if (input.wage !== undefined) data.wage = input.wage;
    if (input.wageType) data.wageType = input.wageType;
    if (input.startDate) data.startDate = new Date(input.startDate);
    if (input.endDate !== undefined) data.endDate = input.endDate ? new Date(input.endDate) : null;
    if (input.status) data.status = input.status;
    if (input.departmentId) data.departmentId = input.departmentId;
    if (input.jobPositionId) data.jobPositionId = input.jobPositionId;
    if (input.workingScheduleId) data.workingScheduleId = input.workingScheduleId;
    if (input.salaryStructureId) data.salaryStructureId = input.salaryStructureId;
    if (input.notes !== undefined) data.notes = input.notes;

    return prisma.contract.update({
      where: { id },
      data,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        department: { select: { id: true, name: true, code: true } },
        jobPosition: { select: { id: true, title: true, code: true } },
        salaryStructure: { select: { id: true, name: true, code: true } },
      },
    });
  }

  /**
   * Complete-period contract selection rule for payroll eligibility.
   * Period bounds [periodStart, periodEnd] require:
   * contract.startDate <= periodStart AND (contract.endDate IS NULL OR contract.endDate >= periodEnd)
   */
  static async getEligibleContractForPeriod(employeeId: string, periodStart: Date, periodEnd: Date) {
    const matching = await prisma.contract.findMany({
      where: {
        employeeId,
        status: ContractStatus.ACTIVE,
        startDate: { lte: periodStart },
        OR: [
          { endDate: null },
          { endDate: { gte: periodEnd } },
        ],
      },
      include: {
        salaryStructure: true,
        workingSchedule: true,
      },
    });

    if (matching.length === 0) {
      return null;
    }

    if (matching.length > 1) {
      throw new BusinessRuleError(
        `Employee '${employeeId}' has ${matching.length} active contracts that qualify for period ${periodStart.toISOString()} - ${periodEnd.toISOString()}. A single active contract must be uniquely identifiable.`,
        'MULTIPLE_ACTIVE_CONTRACTS'
      );
    }

    return matching[0];
  }
}
