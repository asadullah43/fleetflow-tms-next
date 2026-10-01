/**
 * The single place a thrown error becomes a client-facing response.
 *
 *   service throws AppError (registered ERROR_CODE)  ─┐
 *   Prisma constraint error                           ├─> toAppError() ─> standard error envelope
 *   anything else (bug, outage)                      ─┘
 *
 * The client only ever receives the registered, safe ERROR_DESCRIPTION;
 * the real cause of a server fault is logged here, once.
 */
import { AppError } from '../classes/app-error.js';
import { ErrorCode } from '../global_config/error-codes.js';

/** What kind of operation failed — decides how a foreign-key violation reads to the user. */
export type OperationKind = 'read' | 'write' | 'delete';

function prismaCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^P\d{4}$/.test(code) ? code : undefined;
}

/**
 * A unique or foreign-key violation is the caller's mistake, not a
 * server fault, so it becomes a 4xx with a message saying what went wrong.
 */
function fromPrismaError(error: unknown, op: OperationKind): AppError | undefined {
  switch (prismaCode(error)) {
    case 'P2002':
      return AppError.from(ErrorCode.SYS_DUPLICATE, 409, error);
    case 'P2003':
    case 'P2014':
      return op === 'delete' ? AppError.from(ErrorCode.SYS_RECORD_IN_USE, 400, error) : AppError.from(ErrorCode.SYS_INVALID_REFERENCE, 400, error);
    case 'P2025':
      return AppError.from(ErrorCode.SYS_RECORD_NOT_FOUND, 404, error);
    default:
      return undefined;
  }
}

/**
 * Normalizes anything thrown into an AppError: a deliberate 4xx passes
 * through; a 5xx whose cause is a Prisma constraint error is downgraded
 * to the matching 4xx; anything else becomes the generic technical error.
 */
export function toAppError(error: unknown, op: OperationKind = 'write'): AppError {
  if (error instanceof AppError) {
    if (error.statusCode < 500) return error;
    return fromPrismaError(error.cause, op) ?? error;
  }
  return fromPrismaError(error, op) ?? AppError.from(ErrorCode.SYS_UNEXPECTED, 500, error);
}
