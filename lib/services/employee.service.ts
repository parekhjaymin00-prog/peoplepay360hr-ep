import prisma from '../prisma';
import { generateUuidV7 } from '../utils/id';
import { Gender, EmploymentType, EmployeeStatus, ContractStatus } from '@prisma/client';
import { ValidationError, NotFoundError, BusinessRuleError } from '../errors';

export interface CreateEmployeeInput {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  dateOfBirth?: string | null; // ISO Date "YYYY-MM-DD"
  gender?: Gender;
  departmentId: string;
  jobPositionId: string;
  managerId?: string | null;
  workingScheduleId: string;
  employmentType: EmploymentType;
  hireDate: string; // ISO Date "YYYY-MM-DD"
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankRoutingCode?: string | null;
  panOrTaxId?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
  userId?: string | null;
}

export interface UpdateEmployeeInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  dateOfBirth?: string | null;
  gender?: Gender;
  departmentId?: string;
  jobPositionId?: string;
  managerId?: string | null;
  workingScheduleId?: string;
  employmentType?: EmploymentType;
  status?: EmployeeStatus;
  hireDate?: string;
  terminationDate?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankRoutingCode?: string | null;
  panOrTaxId?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
  userId?: string | null;
}

export interface ListEmployeesFilter {
  departmentId?: string;
  status?: EmployeeStatus;
  employmentType?: EmploymentType;
  search?: string;
}

export class EmployeeService {
  static async createEmployee(input: CreateEmployeeInput) {
    const email = input.email.trim().toLowerCase();
    const employeeNumber = input.employeeNumber.trim().toUpperCase();

    // Check unique employeeNumber and email
    const existing = await prisma.employee.findFirst({
      where: {
        OR: [{ email }, { employeeNumber }],
      },
    });

    if (existing) {
      if (existing.email === email) throw new ValidationError(`Employee with email '${email}' already exists`);
      throw new ValidationError(`Employee with badge number '${employeeNumber}' already exists`);
    }

    // Verify Department
    const dept = await prisma.department.findUnique({ where: { id: input.departmentId } });
    if (!dept) throw new NotFoundError(`Department '${input.departmentId}' not found`);

    // Verify Job Position
    const job = await prisma.jobPosition.findUnique({ where: { id: input.jobPositionId } });
    if (!job) throw new NotFoundError(`Job Position '${input.jobPositionId}' not found`);
    if (job.departmentId !== input.departmentId) {
      throw new ValidationError(`Job Position '${job.title}' does not belong to Department '${dept.name}'`);
    }

    // Verify Working Schedule
    const schedule = await prisma.workingSchedule.findUnique({ where: { id: input.workingScheduleId } });
    if (!schedule) throw new NotFoundError(`Working Schedule '${input.workingScheduleId}' not found`);

    // Verify Manager
    if (input.managerId) {
      const manager = await prisma.employee.findUnique({ where: { id: input.managerId } });
      if (!manager) throw new NotFoundError(`Manager '${input.managerId}' not found`);
    }

    // Verify User mapping if provided
    if (input.userId) {
      const user = await prisma.user.findUnique({ where: { id: input.userId } });
      if (!user) throw new NotFoundError(`User '${input.userId}' not found`);
      const existingUserEmp = await prisma.employee.findUnique({ where: { userId: input.userId } });
      if (existingUserEmp) throw new ValidationError(`User account '${input.userId}' is already linked to employee '${existingUserEmp.employeeNumber}'`);
    }

    const hireDate = new Date(input.hireDate);
    const dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;

    return prisma.employee.create({
      data: {
        id: generateUuidV7(),
        employeeNumber,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email,
        phone: input.phone ?? null,
        avatarUrl: input.avatarUrl ?? null,
        dateOfBirth,
        gender: input.gender ?? Gender.NOT_SPECIFIED,
        departmentId: input.departmentId,
        jobPositionId: input.jobPositionId,
        managerId: input.managerId ?? null,
        workingScheduleId: input.workingScheduleId,
        employmentType: input.employmentType,
        status: EmployeeStatus.ACTIVE,
        hireDate,
        bankName: input.bankName ?? null,
        bankAccountNumber: input.bankAccountNumber ?? null,
        bankRoutingCode: input.bankRoutingCode ?? null,
        panOrTaxId: input.panOrTaxId ?? null,
        address: input.address ?? null,
        emergencyContact: input.emergencyContact ?? null,
        userId: input.userId ?? null,
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        jobPosition: { select: { id: true, title: true, code: true } },
        manager: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        workingSchedule: { select: { id: true, name: true, totalWeeklyHours: true } },
      },
    });
  }

  static async listEmployees(filter?: ListEmployeesFilter) {
    const where: any = {};

    if (filter?.departmentId) where.departmentId = filter.departmentId;
    if (filter?.status) where.status = filter.status;
    if (filter?.employmentType) where.employmentType = filter.employmentType;

    if (filter?.search) {
      const q = filter.search.trim();
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { employeeNumber: { contains: q, mode: 'insensitive' } },
      ];
    }

    return prisma.employee.findMany({
      where,
      orderBy: { lastName: 'asc' },
      include: {
        department: { select: { id: true, name: true, code: true } },
        jobPosition: { select: { id: true, title: true, code: true } },
        manager: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        workingSchedule: { select: { id: true, name: true, totalWeeklyHours: true } },
        _count: {
          select: {
            contracts: true,
            attendances: true,
            timeOffRequests: true,
            payslips: true,
          },
        },
      },
    });
  }

  static async getEmployeeById(id: string) {
    const emp = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        jobPosition: true,
        manager: { select: { id: true, firstName: true, lastName: true, employeeNumber: true, email: true } },
        directReports: { select: { id: true, firstName: true, lastName: true, employeeNumber: true, jobPosition: { select: { title: true } } } },
        workingSchedule: {
          include: {
            days: { orderBy: { dayOfWeek: 'asc' } },
          },
        },
        contracts: {
          orderBy: { startDate: 'desc' },
          include: {
            salaryStructure: { select: { id: true, name: true, code: true } },
          },
        },
        timeOffAllocations: {
          where: { status: 'APPROVED' },
          include: { timeOffType: true },
        },
        _count: {
          select: {
            contracts: true,
            attendances: true,
            timeOffRequests: true,
            timeOffAllocations: true,
            payslips: true,
          },
        },
      },
    });

    if (!emp) {
      throw new NotFoundError(`Employee with ID '${id}' not found`);
    }

    return emp;
  }

  static async updateEmployee(id: string, input: UpdateEmployeeInput) {
    const emp = await this.getEmployeeById(id);

    if (input.email && input.email.trim().toLowerCase() !== emp.email) {
      const normalizedEmail = input.email.trim().toLowerCase();
      const existing = await prisma.employee.findUnique({ where: { email: normalizedEmail } });
      if (existing) throw new ValidationError(`Email '${normalizedEmail}' is already used by another employee`);
    }

    if (input.managerId !== undefined) {
      if (input.managerId === id) {
        throw new BusinessRuleError('An employee cannot be their own manager', 'SELF_MANAGER_ERROR');
      }
      if (input.managerId) {
        const manager = await prisma.employee.findUnique({ where: { id: input.managerId } });
        if (!manager) throw new NotFoundError(`Manager employee '${input.managerId}' not found`);
      }
    }

    if (input.departmentId && input.departmentId !== emp.departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: input.departmentId } });
      if (!dept) throw new NotFoundError(`Department '${input.departmentId}' not found`);
    }

    if (input.jobPositionId && input.jobPositionId !== emp.jobPositionId) {
      const targetDeptId = input.departmentId ?? emp.departmentId;
      const job = await prisma.jobPosition.findUnique({ where: { id: input.jobPositionId } });
      if (!job) throw new NotFoundError(`Job Position '${input.jobPositionId}' not found`);
      if (job.departmentId !== targetDeptId) {
        throw new ValidationError(`Job Position '${job.title}' does not belong to Department ID '${targetDeptId}'`);
      }
    }

    if (input.workingScheduleId && input.workingScheduleId !== emp.workingScheduleId) {
      const schedule = await prisma.workingSchedule.findUnique({ where: { id: input.workingScheduleId } });
      if (!schedule) throw new NotFoundError(`Working Schedule '${input.workingScheduleId}' not found`);
    }

    const data: any = {};
    if (input.firstName) data.firstName = input.firstName.trim();
    if (input.lastName) data.lastName = input.lastName.trim();
    if (input.email) data.email = input.email.trim().toLowerCase();
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl;
    if (input.dateOfBirth !== undefined) data.dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
    if (input.gender) data.gender = input.gender;
    if (input.departmentId) data.departmentId = input.departmentId;
    if (input.jobPositionId) data.jobPositionId = input.jobPositionId;
    if (input.managerId !== undefined) data.managerId = input.managerId;
    if (input.workingScheduleId) data.workingScheduleId = input.workingScheduleId;
    if (input.employmentType) data.employmentType = input.employmentType;
    if (input.status) data.status = input.status;
    if (input.hireDate) data.hireDate = new Date(input.hireDate);
    if (input.terminationDate !== undefined) data.terminationDate = input.terminationDate ? new Date(input.terminationDate) : null;
    if (input.bankName !== undefined) data.bankName = input.bankName;
    if (input.bankAccountNumber !== undefined) data.bankAccountNumber = input.bankAccountNumber;
    if (input.bankRoutingCode !== undefined) data.bankRoutingCode = input.bankRoutingCode;
    if (input.panOrTaxId !== undefined) data.panOrTaxId = input.panOrTaxId;
    if (input.address !== undefined) data.address = input.address;
    if (input.emergencyContact !== undefined) data.emergencyContact = input.emergencyContact;
    if (input.userId !== undefined) data.userId = input.userId;

    return prisma.employee.update({
      where: { id },
      data,
      include: {
        department: { select: { id: true, name: true, code: true } },
        jobPosition: { select: { id: true, title: true, code: true } },
        manager: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        workingSchedule: { select: { id: true, name: true, totalWeeklyHours: true } },
      },
    });
  }

  static async terminateEmployee(id: string, terminationDateStr?: string) {
    const emp = await this.getEmployeeById(id);
    const termDate = terminationDateStr ? new Date(terminationDateStr) : new Date();

    if (termDate < emp.hireDate) {
      throw new BusinessRuleError('Termination date cannot be before employee hire date', 'INVALID_TERMINATION_DATE');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Update employee status
      const updatedEmp = await tx.employee.update({
        where: { id },
        data: {
          status: EmployeeStatus.TERMINATED,
          terminationDate: termDate,
        },
      });

      // 2. Auto-expire active contracts
      await tx.contract.updateMany({
        where: {
          employeeId: id,
          status: ContractStatus.ACTIVE,
        },
        data: {
          status: ContractStatus.EXPIRED,
          endDate: termDate,
        },
      });

      return updatedEmp;
    });
  }
}
