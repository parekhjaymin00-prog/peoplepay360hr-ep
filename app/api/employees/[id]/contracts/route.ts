import { NextRequest } from 'next/server';
import { z } from 'zod';
import { WageType, ContractStatus } from '@prisma/client';
import { requireAuth, requirePermission } from '@/lib/auth/guards';
import { ContractService } from '@/lib/services/contract.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';
import { AuthorizationError } from '@/lib/errors';

const createContractSchema = z.object({
  contractNumber: z.string().min(1, 'Contract number is required'),
  departmentId: z.string().uuid('Valid department ID is required'),
  jobPositionId: z.string().uuid('Valid job position ID is required'),
  workingScheduleId: z.string().uuid('Valid working schedule ID is required'),
  salaryStructureId: z.string().uuid('Valid salary structure ID is required'),
  wage: z.number().positive('Wage must be greater than 0'),
  wageType: z.nativeEnum(WageType).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be 'YYYY-MM-DD'"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be 'YYYY-MM-DD'").nullable().optional(),
  status: z.nativeEnum(ContractStatus).optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const isSelf = user.employee?.id === id;
    const canReadAll = user.permissions.includes('contract.read') || user.role.code === 'ADMIN';

    if (!canReadAll && !isSelf) {
      throw new AuthorizationError('You do not have permission to view contracts for this employee');
    }

    const contracts = await ContractService.listContractsByEmployeeId(id);
    return jsonSuccess({ contracts });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'contract.write');
    const { id } = await params;
    const body = await request.json();
    const data = createContractSchema.parse(body);

    const contract = await ContractService.createContract({
      ...data,
      employeeId: id,
    });

    return jsonSuccess({ contract }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
