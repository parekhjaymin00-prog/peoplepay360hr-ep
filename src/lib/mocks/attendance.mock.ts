import { AttendanceRecord, WorkingSchedule } from '@/types/attendance.types';

/**
 * VISUAL PRESENTATION MOCK DATA ONLY.
 */
export const MOCK_SCHEDULES: WorkingSchedule[] = [
  {
    id: 'sch-1',
    name: 'Standard 40h (Mon-Fri 9-5)',
    code: 'STD-40',
    type: 'full_time',
    totalWeeklyHours: 40.0,
    assignedEmployeesCount: 4,
    patterns: [
      { day: 'monday', active: true, startTime: '09:00', endTime: '18:00', breakHours: 1.0 },
      { day: 'tuesday', active: true, startTime: '09:00', endTime: '18:00', breakHours: 1.0 },
      { day: 'wednesday', active: true, startTime: '09:00', endTime: '18:00', breakHours: 1.0 },
      { day: 'thursday', active: true, startTime: '09:00', endTime: '18:00', breakHours: 1.0 },
      { day: 'friday', active: true, startTime: '09:00', endTime: '18:00', breakHours: 1.0 },
      { day: 'saturday', active: false, startTime: '09:00', endTime: '13:00', breakHours: 0.0 },
      { day: 'sunday', active: false, startTime: '09:00', endTime: '13:00', breakHours: 0.0 },
    ],
  },
  {
    id: 'sch-2',
    name: 'Flexible 35h Schedule',
    code: 'FLEX-35',
    type: 'full_time',
    totalWeeklyHours: 35.0,
    assignedEmployeesCount: 1,
    patterns: [
      { day: 'monday', active: true, startTime: '09:30', endTime: '17:30', breakHours: 1.0 },
      { day: 'tuesday', active: true, startTime: '09:30', endTime: '17:30', breakHours: 1.0 },
      { day: 'wednesday', active: true, startTime: '09:30', endTime: '17:30', breakHours: 1.0 },
      { day: 'thursday', active: true, startTime: '09:30', endTime: '17:30', breakHours: 1.0 },
      { day: 'friday', active: true, startTime: '09:30', endTime: '17:30', breakHours: 1.0 },
      { day: 'saturday', active: false, startTime: '09:00', endTime: '13:00', breakHours: 0.0 },
      { day: 'sunday', active: false, startTime: '09:00', endTime: '13:00', breakHours: 0.0 },
    ],
  },
];

export const MOCK_ATTENDANCE: AttendanceRecord[] = [
  {
    id: 'att-1',
    employeeId: 'emp-1',
    employeeName: 'Alexander Wright',
    department: 'Engineering',
    date: '2026-03-05',
    checkIn: '08:55 AM',
    checkOut: '06:05 PM',
    workedHours: 8.16,
    status: 'normal',
  },
  {
    id: 'att-2',
    employeeId: 'emp-2',
    employeeName: 'Sophia Martinez',
    department: 'Product & Design',
    date: '2026-03-05',
    checkIn: '09:18 AM',
    checkOut: '06:00 PM',
    workedHours: 7.7,
    status: 'late',
  },
  {
    id: 'att-3',
    employeeId: 'emp-3',
    employeeName: 'Eleanor Vance',
    department: 'Executive',
    date: '2026-03-05',
    checkIn: '08:45 AM',
    checkOut: '07:15 PM',
    workedHours: 9.5,
    status: 'overtime',
  },
  {
    id: 'att-4',
    employeeId: 'emp-4',
    employeeName: 'David Kim',
    department: 'Finance & Payroll',
    date: '2026-03-05',
    checkIn: '09:00 AM',
    checkOut: undefined, // Still checked in or missing checkout
    workedHours: 4.5,
    status: 'missing_checkout',
  },
  {
    id: 'att-5',
    employeeId: 'emp-5',
    employeeName: 'Marcus Sterling',
    department: 'Sales & Ops',
    date: '2026-03-04',
    checkIn: '09:30 AM',
    checkOut: '05:30 PM',
    workedHours: 7.0,
    status: 'manual_edit',
    isCorrected: true,
    manualCorrectionReason: 'Badge scanner offline at reception desk; corrected by HR.',
  },
];
