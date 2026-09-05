import { apiClient } from './api.client';
import { ApiResponse } from '@/types/common.types';
import { AttendanceRecord, WorkingSchedule } from '@/types/attendance.types';

export const attendanceService = {
  async getAttendanceRecords(): Promise<ApiResponse<AttendanceRecord[]>> {
    return apiClient.get<AttendanceRecord[]>('/api/attendance');
  },

  async getAttendanceByEmployeeId(employeeId: string): Promise<ApiResponse<AttendanceRecord[]>> {
    return apiClient.get<AttendanceRecord[]>(`/api/attendance?employeeId=${employeeId}`);
  },

  async getWorkingSchedules(): Promise<ApiResponse<WorkingSchedule[]>> {
    // Corrected: Backend uses /api/payroll/working-schedules
    return apiClient.get<WorkingSchedule[]>('/api/payroll/working-schedules');
  },

  async getWorkingScheduleById(id: string): Promise<ApiResponse<WorkingSchedule | undefined>> {
    return apiClient.get<WorkingSchedule | undefined>(`/api/payroll/working-schedules/${id}`);
  },

  async checkIn(): Promise<ApiResponse<AttendanceRecord>> {
    return apiClient.post<AttendanceRecord>('/api/attendance/check-in');
  },

  async checkOut(): Promise<ApiResponse<AttendanceRecord>> {
    return apiClient.post<AttendanceRecord>('/api/attendance/check-out');
  },
};

