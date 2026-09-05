import { TimeOffAllocation, TimeOffRequest, TimeOffType } from '@/types/timeoff.types';

/**
 * VISUAL PRESENTATION MOCK DATA ONLY.
 */
export const MOCK_TIMEOFF_TYPES: TimeOffType[] = [
  { id: 'tot-1', name: 'Paid Annual Leave', code: 'PAID', unit: 'days', requiresAllocation: true, color: '#10b981' },
  { id: 'tot-2', name: 'Sick Leave', code: 'SICK', unit: 'days', requiresAllocation: true, color: '#f59e0b' },
  { id: 'tot-3', name: 'Unpaid Leave', code: 'UNPAID', unit: 'days', requiresAllocation: false, color: '#64748b' },
  { id: 'tot-4', name: 'Compassionate Leave', code: 'COMP', unit: 'days', requiresAllocation: false, color: '#0284c7' },
];

export const MOCK_TIMEOFF_ALLOCATIONS: TimeOffAllocation[] = [
  {
    id: 'alc-1',
    employeeId: 'emp-1',
    employeeName: 'Alexander Wright',
    timeOffTypeId: 'tot-1',
    timeOffTypeName: 'Paid Annual Leave',
    totalDays: 20,
    takenDays: 4,
    remainingDays: 16,
    validityStart: '2026-01-01',
    validityEnd: '2026-12-31',
    status: 'approved',
  },
  {
    id: 'alc-2',
    employeeId: 'emp-2',
    employeeName: 'Sophia Martinez',
    timeOffTypeId: 'tot-1',
    timeOffTypeName: 'Paid Annual Leave',
    totalDays: 20,
    takenDays: 6,
    remainingDays: 14,
    validityStart: '2026-01-01',
    validityEnd: '2026-12-31',
    status: 'approved',
  },
  {
    id: 'alc-3',
    employeeId: 'emp-4',
    employeeName: 'David Kim',
    timeOffTypeId: 'tot-1',
    timeOffTypeName: 'Paid Annual Leave',
    totalDays: 20,
    takenDays: 3,
    remainingDays: 17,
    validityStart: '2026-01-01',
    validityEnd: '2026-12-31',
    status: 'approved',
  },
];

export const MOCK_TIMEOFF_REQUESTS: TimeOffRequest[] = [
  {
    id: 'req-1',
    requestNumber: 'REQ-2026-009',
    employeeId: 'emp-1',
    employeeName: 'Alexander Wright',
    department: 'Engineering',
    timeOffTypeId: 'tot-1',
    timeOffTypeName: 'Paid Annual Leave',
    startDate: '2026-03-23',
    endDate: '2026-03-25',
    duration: 3,
    unit: 'days',
    status: 'submitted', // PENDING APPROVAL
    reason: 'Attending cloud architecture summit',
    submittedAt: '2026-03-02',
  },
  {
    id: 'req-2',
    requestNumber: 'REQ-2026-008',
    employeeId: 'emp-4',
    employeeName: 'David Kim',
    department: 'Finance & Payroll',
    timeOffTypeId: 'tot-2',
    timeOffTypeName: 'Sick Leave',
    startDate: '2026-03-10',
    endDate: '2026-03-10',
    duration: 1,
    unit: 'days',
    status: 'submitted', // PENDING APPROVAL
    reason: 'Dental appointment',
    submittedAt: '2026-03-04',
  },
  {
    id: 'req-3',
    requestNumber: 'REQ-2026-004',
    employeeId: 'emp-2',
    employeeName: 'Sophia Martinez',
    department: 'Product & Design',
    timeOffTypeId: 'tot-1',
    timeOffTypeName: 'Paid Annual Leave',
    startDate: '2026-02-16',
    endDate: '2026-02-20',
    duration: 5,
    unit: 'days',
    status: 'approved',
    reason: 'Family vacation',
    submittedAt: '2026-02-01',
    approvedBy: 'Eleanor Vance',
  },
];
