export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  warnings?: string[];
}

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: Record<string, string[]>;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

export type ViewMode = 'list' | 'kanban';
