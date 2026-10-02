/**
 * The API contract shared by every module (see proto/common.proto
 * ApiResponse). `models/` holds shared TypeScript contracts only — the
 * database model is prisma/schema.prisma, which stays authoritative.
 */

export enum ErrorFilter {
  USER_END_VIOLATION = 'USER_END_VIOLATION',
  TECHNICAL_ISSUE = 'TECHNICAL_ISSUE',
  INVALID_REQUEST = 'INVALID_REQUEST',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  USER_NOT_AUTHENTICATED = 'USER_NOT_AUTHENTICATED',
  USER_NOT_AUTHORIZED = 'USER_NOT_AUTHORIZED',
}

export type RateLimitType = 'IP' | 'USER' | 'TENANT' | 'API_KEY' | 'GLOBAL';

export interface RateLimitInfo {
  type: RateLimitType;
  retryAfterSeconds: number;
  remainingPoints: number;
}

export interface ApiError {
  STATUS: 'ERROR';
  ERROR_FILTER: ErrorFilter;
  ERROR_CODE: string;
  ERROR_DESCRIPTION: string;
  RATE_LIMIT?: RateLimitInfo;
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  pagination: Pagination;
}

/** A validated list request (see validations/common.validation.ts). */
export interface ListQuery {
  page: number;
  pageSize: number;
  search: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  filters: Record<string, string>;
}
