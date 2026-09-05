import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/api/proxy-helper";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyToBackend(request, `/api/employees/${id}/contracts`, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: unknown = undefined;
  try {
    body = await request.json();
  } catch {
    // Body is optional
  }
  return proxyToBackend(request, `/api/employees/${id}/contracts`, 'POST', body);
}
