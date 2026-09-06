import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/api/proxy-helper";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queryString = searchParams.toString();
  const path = queryString ? `/api/payroll/payslips?${queryString}` : '/api/payroll/payslips';
  return proxyToBackend(request, path, 'GET');
}