import * as grpc from '@grpc/grpc-js';
import { ErrorFilter, ErrorResponse } from './error-response.interface.js';

/**
 * Same structured error shape the legacy NestJS app used (AppError +
 * ErrorCode table), adapted for gRPC instead of HTTP.
 *
 * gRPC has no HTTP status codes, so `statusCode` maps to a grpc.status
 * via `toGrpcStatus()`, and the full structured payload (the old
 * ERROR_FILTER/ERROR_CODE/ERROR_DESCRIPTION envelope) is attached as
 * JSON in gRPC trailing metadata under `app-error-bin` so frontend
 * error handling can be a near-direct port of the old REST error UI.
 */
export class AppError extends Error {
  public readonly errorCode: string;
  public readonly errorFilter: ErrorFilter;
  public readonly errorDescription: string;
  public readonly statusCode: number;

  constructor(params: {
    errorCode: string;
    errorFilter: ErrorFilter;
    errorDescription: string;
    statusCode?: number;
    cause?: Error;
  }) {
    super(params.errorDescription, { cause: params.cause });
    this.name = 'AppError';
    this.errorCode = params.errorCode;
    this.errorFilter = params.errorFilter;
    this.errorDescription = params.errorDescription;
    this.statusCode = params.statusCode ?? 500;

    // The client only ever sees `errorDescription` (a safe, generic
    // message) — log the real underlying cause server-side so a 500
    // is actually diagnosable from `docker compose logs api` instead
    // of a dead end.
    if (this.statusCode >= 500) {
      // eslint-disable-next-line no-console
      console.error(`[AppError ${this.errorCode}]`, params.cause ?? this);
    }
  }

  toResponse(): ErrorResponse {
    return {
      STATUS: 'ERROR',
      ERROR_FILTER: this.errorFilter,
      ERROR_CODE: this.errorCode,
      ERROR_DESCRIPTION: this.errorDescription,
    };
  }

  /** HTTP-style status code -> nearest grpc.status. */
  private toGrpcStatus(): grpc.status {
    switch (this.statusCode) {
      case 400:
        return grpc.status.INVALID_ARGUMENT;
      case 401:
        return grpc.status.UNAUTHENTICATED;
      case 403:
        return grpc.status.PERMISSION_DENIED;
      case 404:
        return grpc.status.NOT_FOUND;
      case 409:
        return grpc.status.ALREADY_EXISTS;
      case 429:
        return grpc.status.RESOURCE_EXHAUSTED;
      default:
        return grpc.status.INTERNAL;
    }
  }

  /** Converts to the object shape @grpc/grpc-js callbacks expect as an error. */
  toGrpcServiceError(): grpc.ServiceError {
    const metadata = new grpc.Metadata();
    metadata.set('app-error-bin', Buffer.from(JSON.stringify(this.toResponse())));

    return Object.assign(new Error(this.errorDescription), {
      code: this.toGrpcStatus(),
      details: this.errorDescription,
      metadata,
      name: 'AppError',
    }) as grpc.ServiceError;
  }
}
