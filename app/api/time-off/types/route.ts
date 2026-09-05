import { NextRequest } from 'next/server';
import { z } from 'zod';
import { TimeOffUnit } from '@prisma/client';
import { requireAuth, requirePermission } from '@/lib/auth/guards';
import { TimeOffService } from '@/lib/services/time-off.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

const createTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  unit: z.nativeEnum(TimeOffUnit),
  requiresAllocation: z.boolean().optional(),
  isPaid: z.boolean().optional(),
  color: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const types = await TimeOffService.listTypes(includeInactive);
    return jsonSuccess({ types });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, 'timeoff.type.manage');
    const body = await request.json();
    const data = createTypeSchema.parse(body);

    const type = await TimeOffService.createType(data);
    return jsonSuccess({ type }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
