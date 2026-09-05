import { apiClient } from './api.client';
import { ApiResponse } from '@/types/common.types';
import { TimeOffAllocation, TimeOffRequest, TimeOffType } from '@/types/timeoff.types';

export const timeoffService = {
  async getTimeOffTypes(): Promise<ApiResponse<TimeOffType[]>> {
    return apiClient.get<TimeOffType[]>('/api/time-off/types');
  },

  async getTimeOffRequests(): Promise<ApiResponse<TimeOffRequest[]>> {
    return apiClient.get<TimeOffRequest[]>('/api/time-off/requests');
  },

  async getTimeOffAllocations(): Promise<ApiResponse<TimeOffAllocation[]>> {
    return apiClient.get<TimeOffAllocation[]>('/api/time-off/allocations');
  },

  async getTimeOffRequestsByEmployeeId(employeeId: string): Promise<ApiResponse<TimeOffRequest[]>> {
    return apiClient.get<TimeOffRequest[]>(`/api/time-off/requests?employeeId=${employeeId}`);
  },

  async getAllocationsByEmployeeId(employeeId: string): Promise<ApiResponse<TimeOffAllocation[]>> {
    return apiClient.get<TimeOffAllocation[]>(`/api/time-off/allocations?employeeId=${employeeId}`);
  },

  async createTimeOffRequest(data: Partial<TimeOffRequest>): Promise<ApiResponse<TimeOffRequest>> {
    return apiClient.post<TimeOffRequest>('/api/time-off/requests', data);
  },

  async submitRequest(id: string): Promise<ApiResponse<TimeOffRequest>> {
    return apiClient.post<TimeOffRequest>(`/api/time-off/requests/${id}/submit`);
  },

  async approveRequest(id: string): Promise<ApiResponse<TimeOffRequest>> {
    // Corrected: Using PATCH instead of POST for approve action
    return apiClient.patch<TimeOffRequest>(`/api/time-off/requests/${id}/approve`, {});
  },

  async refuseRequest(id: string, reason?: string): Promise<ApiResponse<TimeOffRequest>> {
    // Backend uses 'reject', but service uses 'refuse' - check API route
    return apiClient.patch<TimeOffRequest>(`/api/time-off/requests/${id}/reject`, { reason });
  },

  async cancelRequest(id: string): Promise<ApiResponse<TimeOffRequest>> {
    return apiClient.post<TimeOffRequest>(`/api/time-off/requests/${id}/cancel`);
  },
};

