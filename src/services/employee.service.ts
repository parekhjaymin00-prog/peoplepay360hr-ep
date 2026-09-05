import { apiClient } from './api.client';
import { ApiResponse } from '@/types/common.types';
import { Contract, Employee } from '@/types/employee.types';

function normalizeEmployee(emp: any): Employee {
  if (!emp) return emp;
  return {
    ...emp,
    id: emp.id,
    employeeCode: emp.employeeCode || emp.employeeNumber || 'EMP',
    employeeNumber: emp.employeeNumber || emp.employeeCode || 'EMP',
    name: emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Employee',
    firstName: emp.firstName || emp.name?.split(' ')[0] || '',
    lastName: emp.lastName || emp.name?.split(' ').slice(1).join(' ') || '',
    workEmail: emp.workEmail || emp.email || '',
    email: emp.email || emp.workEmail || '',
    workPhone: emp.workPhone || emp.phone || '—',
    phone: emp.phone || emp.workPhone || '—',
    department: typeof emp.department === 'string' ? emp.department : (emp.department?.name || 'Operations'),
    jobPosition: typeof emp.jobPosition === 'string' ? emp.jobPosition : (emp.jobPosition?.title || 'Staff'),
    scheduleId: emp.scheduleId || emp.workingScheduleId || emp.workingSchedule?.id || '',
    scheduleName: emp.scheduleName || emp.workingSchedule?.name || 'Standard Schedule',
    status: (emp.status || 'ACTIVE').toLowerCase(),
    hireDate: emp.hireDate ? String(emp.hireDate).split('T')[0] : '2026-01-01',
    bankDetails: emp.bankDetails || (emp.bankName ? {
      bankName: emp.bankName,
      accountNumber: emp.bankAccountNumber || '••••••••',
      routingNumber: emp.bankRoutingCode || '—',
      accountHolderName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
    } : undefined),
    smartCounters: emp.smartCounters || {
      contractsCount: emp._count?.contracts ?? emp.contracts?.length ?? 0,
      attendanceWorkedHours: emp.attendanceWorkedHours ?? 0,
      attendanceRate: emp.attendanceRate ?? 100,
      timeOffPendingCount: emp._count?.timeOffRequests ?? 0,
      timeOffApprovedDays: 0,
      remainingLeaveDays: 0,
    },
  };
}

function normalizeContract(cnt: any): Contract {
  if (!cnt) return cnt;
  return {
    ...cnt,
    id: cnt.id,
    contractReference: cnt.contractReference || cnt.contractNumber || 'CNT',
    contractNumber: cnt.contractNumber || cnt.contractReference || 'CNT',
    employeeId: cnt.employeeId,
    employeeName: cnt.employeeName || (cnt.employee ? `${cnt.employee.firstName || ''} ${cnt.employee.lastName || ''}`.trim() : 'Employee'),
    jobPosition: cnt.jobPosition || cnt.jobPosition?.title || 'Staff',
    department: cnt.department || cnt.department?.name || 'Operations',
    wage: Number(cnt.wage || 0),
    wageType: (cnt.wageType || 'MONTHLY').toLowerCase(),
    startDate: cnt.startDate ? String(cnt.startDate).split('T')[0] : '',
    endDate: cnt.endDate ? String(cnt.endDate).split('T')[0] : undefined,
    salaryStructureId: cnt.salaryStructureId || '',
    salaryStructureName: cnt.salaryStructureName || cnt.salaryStructure?.name || 'Standard Structure',
    workingScheduleId: cnt.workingScheduleId || '',
    workingScheduleName: cnt.workingScheduleName || cnt.workingSchedule?.name || 'Standard Schedule',
    status: (cnt.status || 'ACTIVE').toLowerCase(),
  };
}

export const employeeService = {
  async getEmployees(): Promise<ApiResponse<Employee[]>> {
    const res = await apiClient.get<any>('/api/employees');
    const rawList = res.data?.employees || (Array.isArray(res.data) ? res.data : []);
    return {
      ...res,
      data: rawList.map(normalizeEmployee),
    };
  },

  async getEmployeeById(id: string): Promise<ApiResponse<Employee | undefined>> {
    const res = await apiClient.get<any>(`/api/employees/${id}`);
    const raw = res.data?.employee || res.data;
    return {
      ...res,
      data: raw ? normalizeEmployee(raw) : undefined,
    };
  },

  async getContracts(): Promise<ApiResponse<Contract[]>> {
    const res = await apiClient.get<any>('/api/payroll/contracts');
    const rawList = res.data?.contracts || (Array.isArray(res.data) ? res.data : []);
    return {
      ...res,
      data: rawList.map(normalizeContract),
    };
  },

  async getContractsByEmployeeId(employeeId: string): Promise<ApiResponse<Contract[]>> {
    const res = await apiClient.get<any>(`/api/employees/${employeeId}/contracts`);
    const rawList = res.data?.contracts || (Array.isArray(res.data) ? res.data : []);
    return {
      ...res,
      data: rawList.map(normalizeContract),
    };
  },
};
