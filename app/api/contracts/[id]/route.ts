import { NextRequest } from 'next/server';
import { z } from 'zod';
import { WageType, ContractStatus } from '@prisma/client';
import { requireAuth, requirePermission } from '@/lib/auth/guards';
import { ContractService } from '@/lib/services/contract.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';
import { AuthorizationError } from '@/lib/errors';

const updateContractSchema = z.object({
  wage: z.number().positive().optional(),
  wageType: z.nativeEnum(WageType).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: z.nativeEnum(ContractStatus).optional(),
  departmentId: z.string().uuid().optional(),
  jobPositionId: z.string().uuid().optional(),
  workingScheduleId: z.string().uuid().optional(),
  salaryStructureId: z.string().uuid().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const contract = await ContractService.getContractById(id);

    const isSelf = user.employee?.id === contract.employeeId;
    const canReadAll = user.permissions.includes('contract.read') || user.role.code === 'ADMIN';

    if (!canReadAll && !isSelf) {
      throw new AuthorizationError('You do not have permission to view this contract');
    }

    return jsonSuccess({ contract });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'contract.write');
    const { id } = await params;
    const body = await request.json();
    const data = updateContractSchema.parse(body);

    const contract = await ContractService.updateContract(id, data);
    return jsonSuccess({ contract });
  } catch (error) {
    return jsonError(error);
  }
}
