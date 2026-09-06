import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/api/proxy-helper";

/**
 * CRITICAL: This now calls the REAL backend email-payslips endpoint.
 * No more fake success messages.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToBackend(request, `/api/payroll/payruns/${id}/email-payslips`, 'POST');
}