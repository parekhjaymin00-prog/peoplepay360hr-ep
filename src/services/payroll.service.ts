import { apiClient } from './api.client';
import { ApiResponse } from '@/types/common.types';
import { Payrun, Payslip, PayslipStatus, PayrollDashboardMetrics, SalaryRule, SalaryStructure } from '@/types/payroll.types';

function normalizePayslip(p: any): Payslip {
  if (!p) return p;
  return {
    ...p,
    id: p.id,
    payrunId: p.payrunId,
    payrunName: p.payrunName || p.payrun?.name || p.payrun?.reference || 'General Payrun',
    employeeId: p.employeeId,
    employeeName: p.employeeName || p.employeeNameSnapshot || (p.employee ? `${p.employee.firstName || ''} ${p.employee.lastName || ''}`.trim() : 'Employee'),
    department: p.department || p.departmentNameSnapshot || (p.department?.name || 'Operations'),
    jobPosition: p.jobPosition || p.jobPositionNameSnapshot || (p.jobPosition?.title || 'Staff Member'),
    contractReference: p.contractReference || p.contractNumberSnapshot || p.contract?.contractNumber || 'CNT',
    periodStart: p.periodStart ? String(p.periodStart).split('T')[0] : (p.periodStartDate ? String(p.periodStartDate).split('T')[0] : ''),
    periodEnd: p.periodEnd ? String(p.periodEnd).split('T')[0] : (p.periodEndDate ? String(p.periodEndDate).split('T')[0] : ''),
    status: (p.status || 'PAID').toLowerCase() as PayslipStatus,
    workedDays: Number(p.actualWorkedDays ?? p.workedDays ?? 0),
    workedHours: Number(p.workedHours ?? 0),
    basicSalary: Number(p.basicSalary ?? 0),
    grossSalary: Number(p.grossSalary ?? 0),
    totalDeductions: Number(p.totalDeductions ?? 0),
    netSalary: Number(p.netSalary ?? 0),
    ruleLines: (p.lines || p.ruleLines || []).map((l: any) => ({
      ruleCode: l.ruleCode,
      ruleName: l.ruleName,
      category: (l.category || 'ALLOWANCE').toLowerCase(),
      amount: Number(l.amount || 0),
      sequence: Number(l.sequence || 0),
    })),
    warnings: p.warnings || (p.hasWarnings && p.warningsJson ? JSON.parse(p.warningsJson) : []),
  };
}

export const payrollService = {
  async getDashboardMetrics(): Promise<ApiResponse<PayrollDashboardMetrics>> {
    const res = await apiClient.get<any>('/api/dashboard');
    return {
      ...res,
      data: res.data?.metrics || res.data,
    };
  },

  async getSalaryRules(): Promise<ApiResponse<SalaryRule[]>> {
    const res = await apiClient.get<any>('/api/payroll/salary-rules');
    return {
      ...res,
      data: res.data?.rules || (Array.isArray(res.data) ? res.data : []),
    };
  },

  async createSalaryRule(data: Partial<SalaryRule>): Promise<ApiResponse<SalaryRule>> {
    return apiClient.post<SalaryRule>('/api/payroll/salary-rules', data);
  },

  async updateSalaryRule(id: string, data: Partial<SalaryRule>): Promise<ApiResponse<SalaryRule>> {
    return apiClient.patch<SalaryRule>(`/api/payroll/salary-rules/${id}`, data);
  },

  async getSalaryStructures(): Promise<ApiResponse<SalaryStructure[]>> {
    const res = await apiClient.get<any>('/api/payroll/salary-structures');
    return {
      ...res,
      data: res.data?.structures || (Array.isArray(res.data) ? res.data : []),
    };
  },

  async createSalaryStructure(data: Partial<SalaryStructure>): Promise<ApiResponse<SalaryStructure>> {
    return apiClient.post<SalaryStructure>('/api/payroll/salary-structures', data);
  },

  async updateSalaryStructure(id: string, data: Partial<SalaryStructure>): Promise<ApiResponse<SalaryStructure>> {
    return apiClient.patch<SalaryStructure>(`/api/payroll/salary-structures/${id}`, data);
  },

  async getPayruns(): Promise<ApiResponse<Payrun[]>> {
    const res = await apiClient.get<any>('/api/payroll/payruns');
    return {
      ...res,
      data: res.data?.payruns || (Array.isArray(res.data) ? res.data : []),
    };
  },

  async createPayrun(data: Partial<Payrun>): Promise<ApiResponse<Payrun>> {
    return apiClient.post<Payrun>('/api/payroll/payruns', data);
  },

  async getPayrunById(id: string): Promise<ApiResponse<Payrun | undefined>> {
    const res = await apiClient.get<any>(`/api/payroll/payruns/${id}`);
    return {
      ...res,
      data: res.data?.payrun || res.data,
    };
  },

  async computePayrun(id: string): Promise<ApiResponse<Payrun>> {
    return apiClient.post<Payrun>(`/api/payroll/payruns/${id}/compute`);
  },

  async validatePayrun(id: string): Promise<ApiResponse<Payrun>> {
    return apiClient.post<Payrun>(`/api/payroll/payruns/${id}/validate`);
  },

  async markPaidPayrun(id: string): Promise<ApiResponse<Payrun>> {
    return apiClient.post<Payrun>(`/api/payroll/payruns/${id}/paid`);
  },

  async emailPayslips(id: string): Promise<ApiResponse<{ sent: number }>> {
    return apiClient.post<{ sent: number }>(`/api/payroll/payruns/${id}/email-payslips`);
  },

  async getPayslips(payrunId?: string): Promise<ApiResponse<Payslip[]>> {
    const url = payrunId ? `/api/payroll/payslips?payrunId=${payrunId}` : '/api/payroll/payslips';
    const res = await apiClient.get<any>(url);
    const rawList = res.data?.payslips || (Array.isArray(res.data) ? res.data : []);
    return {
      ...res,
      data: rawList.map(normalizePayslip),
    };
  },

  async getPayslipById(id: string): Promise<ApiResponse<Payslip | undefined>> {
    const res = await apiClient.get<any>(`/api/payroll/payslips/${id}`);
    const raw = res.data?.payslip || res.data;
    return {
      ...res,
      data: raw ? normalizePayslip(raw) : undefined,
    };
  },

  getPayslipPdfUrl(id: string): string {
    return `/api/payroll/payslips/${id}/pdf`;
  },

  async emailPayslip(id: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`/api/payroll/payslips/${id}/email`);
  },
};
