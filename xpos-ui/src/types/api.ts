/**
 * Backend error shape. Align with XPOS ApiError (code, message, requestId, details).
 */
export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiError {
  timestamp: string;
  status: number;
  error: string;
  code: string;
  message: string;
  path: string;
  requestId: string;
  details?: ApiErrorDetail[];
}

/**
 * Paginated response. List endpoints return this shape.
 */
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export interface PageParams {
  page?: number;
  size?: number;
  sort?: string;
}
