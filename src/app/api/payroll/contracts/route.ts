import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/api/proxy-helper";

/**
 * NOTE: Backend uses /api/employees/[employeeId]/contracts
 * This route may need adjustment based on frontend usage
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");
  
  // If employeeId provided, use the correct backend endpoint
  if (employeeId) {
    return proxyToBackend(request, `/api/employees/${employeeId}/contracts`, 'GET');
  }
  
  // Otherwise proxy as-is (backend may handle it or return error)
  return proxyToBackend(request, '/api/payroll/contracts', 'GET');
}