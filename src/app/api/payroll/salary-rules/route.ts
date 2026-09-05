import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/api/proxy-helper";

export async function GET(request: NextRequest) {
  return proxyToBackend(request, '/api/payroll/salary-rules', 'GET');
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyToBackend(request, '/api/payroll/salary-rules', 'POST', body);
}