import prisma from '../prisma';
import { generateUuidV7 } from '../utils/id';
import { ValidationError, NotFoundError } from '../errors';

export interface CreateJobPositionInput {
  title: string;
  code: string;
  departmentId: string;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateJobPositionInput {
  title?: string;
  code?: string;
  departmentId?: string;
  description?: string | null;
  isActive?: boolean;
}

export class JobPositionService {
  static async createJobPosition(input: CreateJobPositionInput) {
    const code = input.code.trim().toUpperCase();
    const title = input.title.trim();

    // Verify department exists
    const dept = await prisma.department.findUnique({
      where: { id: input.departmentId },
    });
    if (!dept) {
      throw new NotFoundError(`Department with ID '${input.departmentId}' not found`);
    }

    // Check unique code
    const existingCode = await prisma.jobPosition.findUnique({
      where: { code },
    });
    if (existingCode) {
      throw new ValidationError(`Job position code '${code}' already exists`);
    }

    // Check unique title per department
    const existingTitle = await prisma.jobPosition.findUnique({
      where: {
        title_departmentId: {
          title,
          departmentId: input.departmentId,
        },
      },
    });
    if (existingTitle) {
      throw new ValidationError(`Job position '${title}' already exists in department '${dept.name}'`);
    }

    return prisma.jobPosition.create({
      data: {
        id: generateUuidV7(),
        title,
        code,
        departmentId: input.departmentId,
        description: input.description ?? null,
        isActive: input.isActive ?? true,
      },
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  static async listJobPositions(departmentId?: string) {
    return prisma.jobPosition.findMany({
      where: departmentId ? { departmentId } : undefined,
      orderBy: { title: 'asc' },
      include: {
        department: {
          select: { id: true, name: true, code: true },
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

  static async getJobPositionById(id: string) {
    const position = await prisma.jobPosition.findUnique({
      where: { id },
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: {
            employees: true,
            contracts: true,
          },
        },
      },
    });

    if (!position) {
      throw new NotFoundError(`Job position with ID '${id}' not found`);
    }

    return position;
  }

  static async updateJobPosition(id: string, input: UpdateJobPositionInput) {
    await this.getJobPositionById(id);

    if (input.departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: input.departmentId },
      });
      if (!dept) {
        throw new NotFoundError(`Department with ID '${input.departmentId}' not found`);
      }
    }

    const data: any = {};
    if (input.title) data.title = input.title.trim();
    if (input.code) data.code = input.code.trim().toUpperCase();
    if (input.departmentId) data.departmentId = input.departmentId;
    if (input.description !== undefined) data.description = input.description;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    return prisma.jobPosition.update({
      where: { id },
      data,
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }
}
