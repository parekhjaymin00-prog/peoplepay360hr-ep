import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { jsonSuccess, jsonError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    return jsonSuccess({ user });
  } catch (error) {
    return jsonError(error);
  }
}
