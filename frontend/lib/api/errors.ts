/** The six categories the backend puts in ERROR_FILTER. */
export type ErrorFilter = 'USER_END_VIOLATION' | 'TECHNICAL_ISSUE' | 'INVALID_REQUEST' | 'RATE_LIMIT_EXCEEDED' | 'USER_NOT_AUTHENTICATED' | 'USER_NOT_AUTHORIZED';

export interface RateLimitInfo {
  type: string;
  retryAfterSeconds: number;
  remainingPoints: number;
}

/**
 * Every failed API call rejects with this. `message` is the backend's
 * user-safe ERROR_DESCRIPTION (or a generic connection message when the
 * backend could not be reached at all — `filter` is then TECHNICAL_ISSUE
 * and `transport` is true).
 */
export class ApiError extends Error {
  readonly code: string;
  readonly filter: ErrorFilter;
  readonly rateLimit?: RateLimitInfo;
  readonly transport: boolean;

  constructor(params: { code: string; filter: ErrorFilter; message: string; rateLimit?: RateLimitInfo; transport?: boolean }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.filter = params.filter;
    this.rateLimit = params.rateLimit;
    this.transport = params.transport ?? false;
  }
}

export const CONNECTION_ERROR_MESSAGE = 'Could not reach the server. Check your connection and try again.';

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isUnauthenticated(error: unknown): boolean {
  return isApiError(error) && error.filter === 'USER_NOT_AUTHENTICATED';
}

/** The text to show a user for any thrown value. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isApiError(error)) return error.message || fallback;
  return fallback;
}
