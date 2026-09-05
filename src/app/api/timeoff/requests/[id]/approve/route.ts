import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/api/proxy-helper";

/**
 * NOTE: Backend uses /api/time-off/* (with hyphen), not /api/timeoff/*
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  return proxyToBackend(request, `/api/time-off/requests/${id}/approve`, 'PATCH', body);
}