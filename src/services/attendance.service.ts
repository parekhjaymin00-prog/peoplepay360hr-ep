import { apiClient } from './api.client';
import { ApiResponse } from '@/types/common.types';
import { AttendanceRecord, AttendanceStatus, WorkingSchedule } from '@/types/attendance.types';

function normalizeAttendanceRecord(a: any): AttendanceRecord {
  if (!a) return a;
  const formatTimeStr = (dateVal: any) => {
    if (!dateVal) return undefined;
    try {
      return new Date(dateVal).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return String(dateVal);
    }
  };

  let normalizedStatus: AttendanceStatus = 'normal';
  const rawStatus = (a.status || '').toUpperCase();
  if (rawStatus === 'LATE') normalizedStatus = 'late';
  else if (a.isOvertime) normalizedStatus = 'overtime';
  else if (a.isManualCorrection) normalizedStatus = 'manual_edit';
  else if (!a.checkOut) normalizedStatus = 'normal';

  return {
    ...a,
    id: a.id,
    employeeId: a.employeeId,
    employeeName: a.employeeName || (a.employee ? `${a.employee.firstName || ''} ${a.employee.lastName || ''}`.trim() : 'Employee'),
    department: a.department || a.employee?.department?.name || 'Operations',
    date: a.date ? String(a.date).split('T')[0] : '',
    checkIn: formatTimeStr(a.checkIn) || '09:00 AM',
    checkOut: formatTimeStr(a.checkOut),
    workedHours: Number(a.workedHours ?? 0),
    status: normalizedStatus,
    isCorrected: !!a.isManualCorrection,
    manualCorrectionReason: a.correctionReason,
  };
}

export const attendanceService = {
  async getAttendanceRecords(): Promise<ApiResponse<AttendanceRecord[]>> {
    const res = await apiClient.get<any>('/api/attendance');
    const rawList = res.data?.attendance || (Array.isArray(res.data) ? res.data : []);
    return {
      ...res,
      data: rawList.map(normalizeAttendanceRecord),
    };
  },

  async getAttendanceByEmployeeId(employeeId: string): Promise<ApiResponse<AttendanceRecord[]>> {
    const res = await apiClient.get<any>(`/api/attendance?employeeId=${employeeId}`);
    const rawList = res.data?.attendance || (Array.isArray(res.data) ? res.data : []);
    return {
      ...res,
      data: rawList.map(normalizeAttendanceRecord),
    };
  },

  async getWorkingSchedules(): Promise<ApiResponse<WorkingSchedule[]>> {
    return apiClient.get<WorkingSchedule[]>('/api/payroll/working-schedules');
  },

  async getWorkingScheduleById(id: string): Promise<ApiResponse<WorkingSchedule | undefined>> {
    return apiClient.get<WorkingSchedule | undefined>(`/api/payroll/working-schedules/${id}`);
  },

  async checkIn(): Promise<ApiResponse<AttendanceRecord>> {
    const res = await apiClient.post<any>('/api/attendance/check-in', {});
    const raw = res.data?.attendance || res.data;
    return {
      ...res,
      data: raw ? normalizeAttendanceRecord(raw) : undefined,
    };
  },

  async checkOut(): Promise<ApiResponse<AttendanceRecord>> {
    const res = await apiClient.post<any>('/api/attendance/check-out', {});
    const raw = res.data?.attendance || res.data;
    return {
      ...res,
      data: raw ? normalizeAttendanceRecord(raw) : undefined,
    };
  },
};
