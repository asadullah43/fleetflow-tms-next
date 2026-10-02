import { ErrorFilter, ApiError, RateLimitInfo } from '../models/api-response.js';

/** One row of the ErrorCode table (global_config/error-codes.ts). */
export interface ErrorCodeEntry {
  code: string;
  filter: ErrorFilter;
  description: string;
}

/**
 * The one error type services throw. `statusCode` is an HTTP-style class
 * (400/401/403/404/409/429/500) used for logging and for deciding whether
 * a failure is the caller's (4xx) or the server's (5xx); the client only
 * ever sees the envelope from `toResponse()`.
 */
export class AppError extends Error {
  public readonly errorCode: string;
  public readonly errorFilter: ErrorFilter;
  public readonly errorDescription: string;
  public readonly statusCode: number;
  public readonly rateLimit?: RateLimitInfo;

  constructor(params: {
    errorCode: string;
    errorFilter: ErrorFilter;
    errorDescription: string;
    statusCode?: number;
    cause?: Error;
    rateLimit?: RateLimitInfo;
  }) {
    super(params.errorDescription, { cause: params.cause });
    this.name = 'AppError';
    this.errorCode = params.errorCode;
    this.errorFilter = params.errorFilter;
    this.errorDescription = params.errorDescription;
    this.statusCode = params.statusCode ?? 500;
    this.rateLimit = params.rateLimit;
  }

  /** Shorthand for "throw this ErrorCode entry with this status". `description` overrides the registered text (e.g. to name the invalid field). */
  static from(entry: ErrorCodeEntry, statusCode: number, cause?: unknown, description?: string): AppError {
    return new AppError({
      errorCode: entry.code,
      errorFilter: entry.filter,
      errorDescription: description ?? entry.description,
      statusCode,
      cause: cause instanceof Error ? cause : undefined,
    });
  }

  toResponse(): ApiError {
    return {
      STATUS: 'ERROR',
      ERROR_FILTER: this.errorFilter,
      ERROR_CODE: this.errorCode,
      ERROR_DESCRIPTION: this.errorDescription,
      ...(this.rateLimit ? { RATE_LIMIT: this.rateLimit } : {}),
    };
  }
}
