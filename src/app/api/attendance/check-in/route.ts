import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/api/proxy-helper';

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyToBackend(request, '/api/attendance/check-in', 'POST', body);
}