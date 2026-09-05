import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/api/proxy-helper";

/**
 * NOTE: Backend uses /api/time-off/* (with hyphen), not /api/timeoff/*
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queryString = searchParams.toString();
  const path = queryString ? `/api/time-off/allocations?${queryString}` : '/api/time-off/allocations';
  return proxyToBackend(request, path, 'GET');
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyToBackend(request, '/api/time-off/allocations', 'POST', body);
}