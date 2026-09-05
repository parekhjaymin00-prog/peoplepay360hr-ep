import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/api/proxy-helper";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToBackend(request, `/api/payroll/payruns/${id}`, 'GET');
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  return proxyToBackend(request, `/api/payroll/payruns/${id}`, 'PATCH', body);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToBackend(request, `/api/payroll/payruns/${id}`, 'DELETE');
}