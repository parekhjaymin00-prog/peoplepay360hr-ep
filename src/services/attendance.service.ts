import { apiClient } from './api.client';
import { ApiResponse } from '@/types/common.types';
import { AttendanceRecord, AttendanceStatus, WorkingSchedule } from '@/types/attendance.types';

interface BackendAttendance {
  id: string;
  employeeId: string;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    department?: { name: string };
  };
  employeeName?: string;
  department?: string;
  date: string | Date;
  checkIn: string | Date;
  checkOut?: string | Date | null;
  workedHours?: number | string;
  status?: string;
  isOvertime?: boolean;
  isManualCorrection?: boolean;
  correctionReason?: string | null;
}

interface AttendanceResponseData {
  attendances?: BackendAttendance[];
  attendance?: BackendAttendance | BackendAttendance[];
}

function normalizeAttendanceRecord(a: BackendAttendance): AttendanceRecord {
  if (!a) return a;
  const formatTimeStr = (dateVal: string | Date | null | undefined): string | undefined => {
    if (!dateVal) return undefined;
    try {
      return new Date(dateVal).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return String(dateVal);
    }
  };

  let normalizedStatus: AttendanceStatus = 'normal';
  const rawStatus = String(a.status || '').toUpperCase();
  if (rawStatus === 'LATE') normalizedStatus = 'late';
  else if (a.isOvertime) normalizedStatus = 'overtime';
  else if (a.isManualCorrection) normalizedStatus = 'manual_edit';
  else if (!a.checkOut) normalizedStatus = 'normal';

  return {
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
    manualCorrectionReason: a.correctionReason || undefined,
  };
}

export const attendanceService = {
  async getAttendanceRecords(): Promise<ApiResponse<AttendanceRecord[]>> {
    const res = await apiClient.get<AttendanceResponseData>('/api/attendance');
    const data = res.data;
    let rawList: BackendAttendance[] = [];
    if (data?.attendances && Array.isArray(data.attendances)) {
      rawList = data.attendances;
    } else if (data?.attendance && Array.isArray(data.attendance)) {
      rawList = data.attendance;
    } else if (Array.isArray(data)) {
      rawList = data as BackendAttendance[];
    }
    return {
      ...res,
      data: rawList.map(normalizeAttendanceRecord),
    };
  },

  async getAttendanceByEmployeeId(employeeId: string): Promise<ApiResponse<AttendanceRecord[]>> {
    const res = await apiClient.get<AttendanceResponseData>(`/api/attendance?employeeId=${employeeId}`);
    const data = res.data;
    let rawList: BackendAttendance[] = [];
    if (data?.attendances && Array.isArray(data.attendances)) {
      rawList = data.attendances;
    } else if (data?.attendance && Array.isArray(data.attendance)) {
      rawList = data.attendance;
    } else if (Array.isArray(data)) {
      rawList = data as BackendAttendance[];
    }
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
    const res = await apiClient.post<AttendanceResponseData>('/api/attendance/check-in', {});
    const data = res.data;
    const raw = (data?.attendance && !Array.isArray(data.attendance) ? data.attendance : data?.attendances?.[0]) || (data as unknown as BackendAttendance);
    return {
      ...res,
      data: raw ? normalizeAttendanceRecord(raw) : undefined,
    };
  },

  async checkOut(): Promise<ApiResponse<AttendanceRecord>> {
    const res = await apiClient.post<AttendanceResponseData>('/api/attendance/check-out', {});
    const data = res.data;
    const raw = (data?.attendance && !Array.isArray(data.attendance) ? data.attendance : data?.attendances?.[0]) || (data as unknown as BackendAttendance);
    return {
      ...res,
      data: raw ? normalizeAttendanceRecord(raw) : undefined,
    };
  },
};
