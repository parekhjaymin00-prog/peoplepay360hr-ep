export interface TimeOffType {
  id: string;
  name: string;
  code: string; // e.g. "PAID", "SICK", "UNPAID"
  unit: 'days' | 'hours';
  requiresAllocation: boolean;
  color: string;
}

export type TimeOffRequestStatus = 'draft' | 'submitted' | 'approved' | 'refused';

export interface TimeOffRequest {
  id: string;
  requestNumber: string; // e.g. "REQ-2026-018"
  employeeId: string;
  employeeName: string;
  department: string;
  timeOffTypeId: string;
  timeOffTypeName: string;
  startDate: string;
  endDate: string;
  duration: number; // e.g. 3.0 days
  unit: 'days' | 'hours';
  status: TimeOffRequestStatus;
  reason?: string;
  submittedAt: string;
  approvedBy?: string;
}

export type AllocationStatus = 'draft' | 'approved' | 'refused';

export interface TimeOffAllocation {
  id: string;
  employeeId: string;
  employeeName: string;
  timeOffTypeId: string;
  timeOffTypeName: string;
  totalDays: number;
  takenDays: number;
  remainingDays: number;
  validityStart: string;
  validityEnd: string;
  status: AllocationStatus;
}
