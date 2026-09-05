import { ApiResponse } from '@/types/common.types';

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Standard HTTP Client for all frontend communications with backend APIs.
 * Automatically handles credentials (cookies), JSON headers, and normalized error throwing.
 */
class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    try {
      const res = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Ensure session cookies are sent/received
      });

      if (res.status === 401) {
        return {
          success: false,
          error: 'Unauthorized session. Please sign in.',
        };
      }

      if (!res.ok) {
        let errorMsg = `Request failed (${res.status})`;
        try {
          const errBody = await res.json();
          errorMsg = errBody.message || errBody.error || errorMsg;
        } catch {
          // Response body was not JSON
        }
        return {
          success: false,
          error: errorMsg,
        };
      }

      // 204 No Content
      if (res.status === 204) {
        return {
          success: true,
          data: undefined as unknown as T,
        };
      }

      const data = await res.json();
      return {
        success: true,
        data: data.data !== undefined ? data.data : data,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error communicating with backend service';
      return {
        success: false,
        error: msg,
      };
    }
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();
export default api;
