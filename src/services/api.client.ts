import { api } from '@/lib/api/client';
import { ApiResponse } from '@/types/common.types';

/**
 * Standard Frontend API Client layer.
 * All requests pass through the real fetch client with session credentials.
 */
export const apiClient = {
  get<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return api.get<T>(endpoint, options);
  },
  post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    return api.post<T>(endpoint, body, options);
  },
  patch<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    return api.patch<T>(endpoint, body, options);
  },
  delete<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return api.delete<T>(endpoint, options);
  },
  request<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return api.request<T>(endpoint, options);
  },
};

export default apiClient;

