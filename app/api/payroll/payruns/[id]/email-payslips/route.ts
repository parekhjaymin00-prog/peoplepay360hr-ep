import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { EmailService } from '@/lib/services/email.service';
import { jsonSuccess, jsonError } from '@/lib/api-response';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const result = await EmailService.sendBulkPayrunEmails(id, user);
    return jsonSuccess({ bulkDelivery: result });
  } catch (error) {
    return jsonError(error);
  }
}
