export type EmployeeStatus = 'active' | 'inactive';

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  routingNumber?: string;
  accountHolderName?: string;
}

export interface EmployeeSmartCounters {
  contractsCount: number;
  activeContractWage?: number;
  attendanceRate: number; // e.g. 96 (%)
  attendanceWorkedHours: number; // e.g. 168 (hrs)
  timeOffPendingCount: number;
  timeOffApprovedDays: number;
  remainingLeaveDays: number;
}

export interface Employee {
  id: string;
  employeeCode: string; // e.g. "EMP-001"
  name: string;
  workEmail: string;
  workPhone: string;
  department: string;
  jobPosition: string;
  managerId?: string;
  managerName?: string;
  scheduleId: string;
  scheduleName: string;
  status: EmployeeStatus;
  avatarUrl?: string;
  hireDate: string;
  bankDetails?: BankDetails;
  smartCounters: EmployeeSmartCounters;
}

export type ContractStatus = 'draft' | 'running' | 'expired' | 'cancelled';

export interface Contract {
  id: string;
  contractReference: string; // e.g. "CNT-2026-004"
  employeeId: string;
  employeeName: string;
  jobPosition: string;
  department: string;
  wage: number;
  wageType: 'monthly' | 'hourly';
  startDate: string;
  endDate?: string;
  salaryStructureId: string;
  salaryStructureName: string;
  workingScheduleId: string;
  workingScheduleName: string;
  status: ContractStatus;
}
