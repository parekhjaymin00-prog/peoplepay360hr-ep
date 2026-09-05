import prisma from '../prisma';
import { generateUuidV7 } from '../utils/id';
import { ValidationError, NotFoundError, BusinessRuleError } from '../errors';

export interface CreateDepartmentInput {
  name: string;
  code: string;
  managerId?: string | null;
  parentDepartmentId?: string | null;
  isActive?: boolean;
}

export interface UpdateDepartmentInput {
  name?: string;
  code?: string;
  managerId?: string | null;
  parentDepartmentId?: string | null;
  isActive?: boolean;
}

export class DepartmentService {
  static async createDepartment(input: CreateDepartmentInput) {
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();

    // Check duplicate code or name
    const existing = await prisma.department.findFirst({
      where: {
        OR: [{ code }, { name }],
      },
    });

    if (existing) {
      if (existing.code === code) {
        throw new ValidationError(`Department with code '${code}' already exists`);
      }
      throw new ValidationError(`Department with name '${name}' already exists`);
    }

    if (input.parentDepartmentId) {
      const parent = await prisma.department.findUnique({
        where: { id: input.parentDepartmentId },
      });
      if (!parent) {
        throw new NotFoundError(`Parent department '${input.parentDepartmentId}' not found`);
      }
    }

    if (input.managerId) {
      const manager = await prisma.employee.findUnique({
        where: { id: input.managerId },
      });
      if (!manager) {
        throw new NotFoundError(`Manager employee '${input.managerId}' not found`);
      }
    }

    return prisma.department.create({
      data: {
        id: generateUuidV7(),
        name,
        code,
        managerId: input.managerId ?? null,
        parentDepartmentId: input.parentDepartmentId ?? null,
        isActive: input.isActive ?? true,
      },
      include: {
        manager: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true },
        },
        parentDepartment: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  static async listDepartments() {
    return prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: {
        manager: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true },
        },
        parentDepartment: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: {
            employees: true,
            jobPositions: true,
          },
        },
      },
    });
  }

  static async getDepartmentById(id: string) {
    const dept = await prisma.department.findUnique({
      where: { id },
      include: {
        manager: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true, email: true },
        },
        parentDepartment: {
          select: { id: true, name: true, code: true },
        },
        childDepartments: {
          select: { id: true, name: true, code: true },
        },
        jobPositions: {
          where: { isActive: true },
          select: { id: true, title: true, code: true },
        },
        _count: {
          select: {
            employees: true,
            contracts: true,
          },
        },
      },
    });

    if (!dept) {
      throw new NotFoundError(`Department with ID '${id}' not found`);
    }

    return dept;
  }

  static async updateDepartment(id: string, input: UpdateDepartmentInput) {
    await this.getDepartmentById(id);

    if (input.parentDepartmentId !== undefined) {
      if (input.parentDepartmentId === id) {
        throw new BusinessRuleError('A department cannot be its own parent', 'CIRCULAR_PARENT_ERROR');
      }
      if (input.parentDepartmentId) {
        const parent = await prisma.department.findUnique({
          where: { id: input.parentDepartmentId },
        });
        if (!parent) {
          throw new NotFoundError(`Parent department '${input.parentDepartmentId}' not found`);
        }
      }
    }

    if (input.managerId !== undefined && input.managerId) {
      const manager = await prisma.employee.findUnique({
        where: { id: input.managerId },
      });
      if (!manager) {
        throw new NotFoundError(`Manager employee '${input.managerId}' not found`);
      }
    }

    const data: any = {};
    if (input.name) data.name = input.name.trim();
    if (input.code) data.code = input.code.trim().toUpperCase();
    if (input.managerId !== undefined) data.managerId = input.managerId;
    if (input.parentDepartmentId !== undefined) data.parentDepartmentId = input.parentDepartmentId;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    return prisma.department.update({
      where: { id },
      data,
      include: {
        manager: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true },
        },
        parentDepartment: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }
}
