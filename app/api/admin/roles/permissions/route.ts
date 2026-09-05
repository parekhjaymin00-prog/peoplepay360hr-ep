import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/guards';
import { AuthService } from '@/lib/services/auth.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    // Requires admin permission management capability
    await requirePermission(request, 'admin.permission.manage');

    const matrix = await AuthService.getRolePermissionMatrix();
    return jsonSuccess({ roles: matrix });
  } catch (error) {
    return jsonError(error);
  }
}
