import { apiClient } from './api.client';
import { ApiResponse } from '@/types/common.types';
import { TimeOffAllocation, TimeOffRequest, TimeOffType, TimeOffRequestStatus, AllocationStatus } from '@/types/timeoff.types';

function normalizeTimeOffType(t: any): TimeOffType {
  if (!t) return t;
  return {
    id: t.id,
    name: t.name,
    code: t.code,
    unit: (t.unit || 'DAYS').toLowerCase() as 'days' | 'hours',
    requiresAllocation: t.requiresAllocation ?? true,
    color: t.color || '#3B82F6',
  };
}

function normalizeTimeOffRequest(r: any): TimeOffRequest {
  if (!r) return r;
  return {
    ...r,
    id: r.id,
    requestNumber: r.requestNumber || 'REQ',
    employeeId: r.employeeId,
    employeeName: r.employeeName || (r.employee ? `${r.employee.firstName || ''} ${r.employee.lastName || ''}`.trim() : 'Employee'),
    department: r.department || r.employee?.department?.name || 'Operations',
    timeOffTypeId: r.timeOffTypeId,
    timeOffTypeName: r.timeOffTypeName || r.timeOffType?.name || 'Time Off',
    startDate: r.startDate ? String(r.startDate).split('T')[0] : '',
    endDate: r.endDate ? String(r.endDate).split('T')[0] : '',
    duration: Number(r.durationQuantity ?? r.duration ?? 0),
    unit: ((r.timeOffType?.unit || r.unit || 'DAYS') as string).toLowerCase() as 'days' | 'hours',
    status: (r.status || 'SUBMITTED').toLowerCase() as TimeOffRequestStatus,
    reason: r.reason || '',
    submittedAt: r.submittedAt || (r.createdAt ? String(r.createdAt).split('T')[0] : ''),
    approvedBy: r.approvedBy ? (typeof r.approvedBy === 'string' ? r.approvedBy : r.approvedBy.email) : undefined,
  };
}

function normalizeTimeOffAllocation(a: any): TimeOffAllocation {
  if (!a) return a;
  return {
    ...a,
    id: a.id,
    employeeId: a.employeeId,
    employeeName: a.employeeName || (a.employee ? `${a.employee.firstName || ''} ${a.employee.lastName || ''}`.trim() : 'Employee'),
    timeOffTypeId: a.timeOffTypeId,
    timeOffTypeName: a.timeOffTypeName || a.timeOffType?.name || 'Leave Quota',
    totalDays: Number(a.allocatedQuantity ?? a.totalDays ?? 0),
    takenDays: Number(a.takenQuantity ?? a.takenDays ?? 0),
    remainingDays: Number(a.remainingQuantity ?? a.remainingDays ?? 0),
    validityStart: a.validFrom ? String(a.validFrom).split('T')[0] : (a.validityStart || ''),
    validityEnd: a.validTo ? String(a.validTo).split('T')[0] : (a.validityEnd || ''),
    status: (a.status || 'APPROVED').toLowerCase() as AllocationStatus,
  };
}

export const timeoffService = {
  async getTimeOffTypes(): Promise<ApiResponse<TimeOffType[]>> {
    const res = await apiClient.get<any>('/api/time-off/types');
    const rawList = res.data?.types || (Array.isArray(res.data) ? res.data : []);
    return {
      ...res,
      data: rawList.map(normalizeTimeOffType),
    };
  },

  async getTimeOffRequests(): Promise<ApiResponse<TimeOffRequest[]>> {
    const res = await apiClient.get<any>('/api/time-off/requests');
    const rawList = res.data?.requests || (Array.isArray(res.data) ? res.data : []);
    return {
      ...res,
      data: rawList.map(normalizeTimeOffRequest),
    };
  },

  async getTimeOffAllocations(): Promise<ApiResponse<TimeOffAllocation[]>> {
    const res = await apiClient.get<any>('/api/time-off/allocations');
    const rawList = res.data?.allocations || (Array.isArray(res.data) ? res.data : []);
    return {
      ...res,
      data: rawList.map(normalizeTimeOffAllocation),
    };
  },

  async getTimeOffRequestsByEmployeeId(employeeId: string): Promise<ApiResponse<TimeOffRequest[]>> {
    const res = await apiClient.get<any>(`/api/time-off/requests?employeeId=${employeeId}`);
    const rawList = res.data?.requests || (Array.isArray(res.data) ? res.data : []);
    return {
      ...res,
      data: rawList.map(normalizeTimeOffRequest),
    };
  },

  async getAllocationsByEmployeeId(employeeId: string): Promise<ApiResponse<TimeOffAllocation[]>> {
    const res = await apiClient.get<any>(`/api/time-off/allocations?employeeId=${employeeId}`);
    const rawList = res.data?.allocations || (Array.isArray(res.data) ? res.data : []);
    return {
      ...res,
      data: rawList.map(normalizeTimeOffAllocation),
    };
  },

  async createTimeOffRequest(data: Partial<TimeOffRequest> & { startDate: string; endDate: string; timeOffTypeId: string; reason?: string }): Promise<ApiResponse<TimeOffRequest>> {
    const res = await apiClient.post<any>('/api/time-off/requests', data);
    const raw = res.data?.request || res.data;
    return {
      ...res,
      data: raw ? normalizeTimeOffRequest(raw) : undefined,
    };
  },

  async submitRequest(id: string): Promise<ApiResponse<TimeOffRequest>> {
    const res = await apiClient.post<any>(`/api/time-off/requests/${id}/submit`);
    const raw = res.data?.request || res.data;
    return {
      ...res,
      data: raw ? normalizeTimeOffRequest(raw) : undefined,
    };
  },

  async approveRequest(id: string): Promise<ApiResponse<TimeOffRequest>> {
    const res = await apiClient.post<any>(`/api/time-off/requests/${id}/approve`);
    const raw = res.data?.request || res.data;
    return {
      ...res,
      data: raw ? normalizeTimeOffRequest(raw) : undefined,
    };
  },

  async refuseRequest(id: string, reason?: string): Promise<ApiResponse<TimeOffRequest>> {
    const res = await apiClient.post<any>(`/api/time-off/requests/${id}/refuse`, { reason });
    const raw = res.data?.request || res.data;
    return {
      ...res,
      data: raw ? normalizeTimeOffRequest(raw) : undefined,
    };
  },

  async cancelRequest(id: string): Promise<ApiResponse<TimeOffRequest>> {
    const res = await apiClient.post<any>(`/api/time-off/requests/${id}/cancel`);
    const raw = res.data?.request || res.data;
    return {
      ...res,
      data: raw ? normalizeTimeOffRequest(raw) : undefined,
    };
  },
};
