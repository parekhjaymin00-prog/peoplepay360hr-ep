import { apiClient } from './api.client';
import { ApiResponse } from '@/types/common.types';
import { Contract, Employee } from '@/types/employee.types';

export const employeeService = {
  async getEmployees(): Promise<ApiResponse<Employee[]>> {
    return apiClient.get<Employee[]>('/api/employees');
  },

  async getEmployeeById(id: string): Promise<ApiResponse<Employee | undefined>> {
    return apiClient.get<Employee | undefined>(`/api/employees/${id}`);
  },

  async getContracts(): Promise<ApiResponse<Contract[]>> {
    // NOTE: Backend contracts are accessed via employee endpoint
    // This method may not work without an employeeId
    return apiClient.get<Contract[]>('/api/payroll/contracts');
  },

  async getContractsByEmployeeId(employeeId: string): Promise<ApiResponse<Contract[]>> {
    // Correct backend endpoint: /api/employees/[id]/contracts
    return apiClient.get<Contract[]>(`/api/employees/${employeeId}/contracts`);
  },
};

