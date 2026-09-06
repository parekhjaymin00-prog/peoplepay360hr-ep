export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface ScheduleDayPattern {
  day: DayOfWeek;
  active: boolean;
  startTime: string; // "09:00"
  endTime: string;   // "17:00"
  breakHours: number; // e.g. 1.0
}

export interface WorkingSchedule {
  id: string;
  name: string;
  code: string;
  type: 'full_time' | 'part_time' | 'shift';
  patterns: ScheduleDayPattern[];
  totalWeeklyHours: number; // Computed automatically
  assignedEmployeesCount: number;
}

export type AttendanceStatus = 'normal' | 'late' | 'overtime' | 'missing_checkout' | 'manual_edit';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  date: string; // YYYY-MM-DD
  checkIn: string; // "09:02 AM"
  checkOut?: string; // "05:14 PM"
  workedHours: number;
  status: AttendanceStatus;
  manualCorrectionReason?: string;
  isCorrected?: boolean;
}
