import { apiClient } from './api.client';
import { ApiResponse } from '@/types/common.types';
import { Payrun, Payslip, PayrollDashboardMetrics, SalaryRule, SalaryStructure } from '@/types/payroll.types';

export const payrollService = {
  async getDashboardMetrics(): Promise<ApiResponse<PayrollDashboardMetrics>> {
    return apiClient.get<PayrollDashboardMetrics>('/api/payroll/metrics');
  },

  async getSalaryRules(): Promise<ApiResponse<SalaryRule[]>> {
    return apiClient.get<SalaryRule[]>('/api/salary-rules');
  },

  async createSalaryRule(data: Partial<SalaryRule>): Promise<ApiResponse<SalaryRule>> {
    return apiClient.post<SalaryRule>('/api/salary-rules', data);
  },

  async updateSalaryRule(id: string, data: Partial<SalaryRule>): Promise<ApiResponse<SalaryRule>> {
    return apiClient.patch<SalaryRule>(`/api/salary-rules/${id}`, data);
  },

  async getSalaryStructures(): Promise<ApiResponse<SalaryStructure[]>> {
    return apiClient.get<SalaryStructure[]>('/api/salary-structures');
  },

  async createSalaryStructure(data: Partial<SalaryStructure>): Promise<ApiResponse<SalaryStructure>> {
    return apiClient.post<SalaryStructure>('/api/salary-structures', data);
  },

  async updateSalaryStructure(id: string, data: Partial<SalaryStructure>): Promise<ApiResponse<SalaryStructure>> {
    return apiClient.patch<SalaryStructure>(`/api/salary-structures/${id}`, data);
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

