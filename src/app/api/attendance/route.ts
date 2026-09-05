import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/api/proxy-helper';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  return proxyToBackend(request, `/api/attendance?${searchParams.toString()}`);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyToBackend(request, '/api/attendance', 'POST', body);
}