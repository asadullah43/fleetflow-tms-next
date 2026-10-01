import * as grpc from '@grpc/grpc-js';
import { AppError } from '../common/errors/app-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { createLogger } from './logger.js';

const log = createLogger('grpc-errors.ts');

/** What kind of write produced a database error — decides how a foreign-key failure reads to the user. */
export type OperationKind = 'read' | 'write' | 'delete';

/** Prisma's known-request error codes we translate into client-facing errors. */
function prismaCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^P\d{4}$/.test(code) ? code : undefined;
}

/**
 * Maps a Prisma constraint error to the error the user should actually
 * see. Services wrap database failures in a generic 500 ("Unable to
 * create X") with the Prisma error as `cause`; a unique or foreign-key
 * violation is the caller's mistake, not a server fault, so it becomes a
 * 4xx with a message that says what went wrong.
 */
function fromPrismaError(error: unknown, op: OperationKind): AppError | undefined {
  switch (prismaCode(error)) {
    case 'P2002':
      return AppError.from(ErrorCode.SYS_DUPLICATE, 409, error);
    case 'P2003':
    case 'P2014':
      return op === 'delete'
        ? AppError.from(ErrorCode.SYS_RECORD_IN_USE, 400, error)
        : AppError.from(ErrorCode.SYS_INVALID_REFERENCE, 400, error);
    case 'P2025':
      return AppError.from(ErrorCode.SYS_RECORD_NOT_FOUND, 404, error);
    default:
      return undefined;
  }
}

/**
 * Normalizes anything a handler threw into an AppError: a deliberate
 * 4xx AppError passes through; a 5xx AppError whose cause is a Prisma
 * constraint error is downgraded to the matching 4xx; anything else
 * becomes the generic "something went wrong".
 */
export function toAppError(error: unknown, op: OperationKind = 'write'): AppError {
  if (error instanceof AppError) {
    if (error.statusCode < 500) return error;
    return fromPrismaError(error.cause, op) ?? error;
  }
  return fromPrismaError(error, op) ?? AppError.from(ErrorCode.SYS_UNEXPECTED, 500, error);
}

/**
 * Sends `error` to a unary gRPC callback in the client-facing shape.
 * Server faults (5xx) are logged here, once, with their real cause — the
 * client only ever receives the safe `errorDescription`.
 */
export function sendError(callback: grpc.sendUnaryData<unknown>, error: unknown, op: OperationKind = 'write'): void {
  const appError = toAppError(error, op);
  if (appError.statusCode >= 500) {
    log.error('001', 'sendError', `${appError.errorCode} ${appError.errorDescription}`, appError.cause ?? error);
  }
  callback(appError.toGrpcServiceError(), null);
}
