import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/api/proxy-helper";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToBackend(request, `/api/payroll/payslips/${id}`, 'GET');
}