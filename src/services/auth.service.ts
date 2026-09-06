import { api } from '@/lib/api/client';
import { ApiResponse } from '@/types/common.types';
import { User } from '@/types/auth.types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user?: User;
  token?: string;
  message?: string;
}

export const authService = {
  /**
   * Fetches the authoritative session user from backend API: GET /api/auth/me
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return api.get<User>('/api/auth/me');
  },

  /**
   * Submits real credentials to backend API: POST /api/auth/login
   */
  async login(credentials: LoginCredentials): Promise<ApiResponse<LoginResponse>> {
    return api.post<LoginResponse>('/api/auth/login', credentials);
  },

  /**
   * Terminates active session on backend API: POST /api/auth/logout
   */
  async logout(): Promise<ApiResponse<void>> {
    try {
      return await api.post<void>('/api/auth/logout');
    } catch {
      return { success: true };
    }
  },
};
