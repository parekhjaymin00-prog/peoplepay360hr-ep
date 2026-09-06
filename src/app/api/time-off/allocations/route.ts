import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/api/proxy-helper";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queryString = searchParams.toString();
  const path = queryString ? `/api/time-off/allocations?${queryString}` : '/api/time-off/allocations';
  return proxyToBackend(request, path, 'GET');
}

export async function POST(request: NextRequest) {
  let body: unknown = undefined;
  try {
    body = await request.json();
  } catch {
    // Body is optional or empty
  }
  return proxyToBackend(request, '/api/time-off/allocations', 'POST', body);
}
