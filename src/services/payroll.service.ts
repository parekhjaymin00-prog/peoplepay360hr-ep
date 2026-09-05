import { apiClient } from './api.client';
import { ApiResponse } from '@/types/common.types';
import { Payrun, Payslip, PayrollDashboardMetrics, SalaryRule, SalaryStructure } from '@/types/payroll.types';

export const payrollService = {
  async getDashboardMetrics(): Promise<ApiResponse<PayrollDashboardMetrics>> {
    // Corrected: Backend uses /api/dashboard, not /api/payroll/metrics
    return apiClient.get<PayrollDashboardMetrics>('/api/dashboard');
  },

  async getSalaryRules(): Promise<ApiResponse<SalaryRule[]>> {
    // Corrected: Backend uses /api/payroll/salary-rules
    return apiClient.get<SalaryRule[]>('/api/payroll/salary-rules');
  },

  async createSalaryRule(data: Partial<SalaryRule>): Promise<ApiResponse<SalaryRule>> {
    return apiClient.post<SalaryRule>('/api/payroll/salary-rules', data);
  },

  async updateSalaryRule(id: string, data: Partial<SalaryRule>): Promise<ApiResponse<SalaryRule>> {
    return apiClient.patch<SalaryRule>(`/api/payroll/salary-rules/${id}`, data);
  },

  async getSalaryStructures(): Promise<ApiResponse<SalaryStructure[]>> {
    // Corrected: Backend uses /api/payroll/salary-structures
    return apiClient.get<SalaryStructure[]>('/api/payroll/salary-structures');
  },

  async createSalaryStructure(data: Partial<SalaryStructure>): Promise<ApiResponse<SalaryStructure>> {
    return apiClient.post<SalaryStructure>('/api/payroll/salary-structures', data);
  },

  async updateSalaryStructure(id: string, data: Partial<SalaryStructure>): Promise<ApiResponse<SalaryStructure>> {
    return apiClient.patch<SalaryStructure>(`/api/payroll/salary-structures/${id}`, data);
  },

  async getPayruns(): Promise<ApiResponse<Payrun[]>> {
    return apiClient.get<Payrun[]>('/api/payroll/payruns');
  },

  async createPayrun(data: Partial<Payrun>): Promise<ApiResponse<Payrun>> {
    return apiClient.post<Payrun>('/api/payroll/payruns', data);
  },

  async getPayrunById(id: string): Promise<ApiResponse<Payrun | undefined>> {
    return apiClient.get<Payrun | undefined>(`/api/payroll/payruns/${id}`);
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
    return apiClient.get<Payslip[]>(url);
  },

  async getPayslipById(id: string): Promise<ApiResponse<Payslip | undefined>> {
    return apiClient.get<Payslip | undefined>(`/api/payroll/payslips/${id}`);
  },

  getPayslipPdfUrl(id: string): string {
    return `/api/payroll/payslips/${id}/pdf`;
  },

  async emailPayslip(id: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`/api/payroll/payslips/${id}/email`);
  },
};

