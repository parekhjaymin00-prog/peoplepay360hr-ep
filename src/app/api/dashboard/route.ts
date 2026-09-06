import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/api/proxy-helper";

export async function GET(request: NextRequest) {
  return proxyToBackend(request, '/api/dashboard', 'GET');
}