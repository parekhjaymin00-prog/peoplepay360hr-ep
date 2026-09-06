import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/api/proxy-helper';

export async function POST(request: NextRequest) {
  let body: unknown = undefined;
  try {
    body = await request.json();
  } catch {
    // Body is optional for check-out
  }
  return proxyToBackend(request, '/api/attendance/check-out', 'POST', body);
}
