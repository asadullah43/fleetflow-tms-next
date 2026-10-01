import * as grpc from '@grpc/grpc-js';
import { verifyJwt, JwtPayload } from './jwt.js';
import { AppError } from '../common/errors/app-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';

/**
 * gRPC equivalent of the legacy JwtAuthGuard: reads the bearer token from
 * call metadata ("authorization: Bearer <jwt>") instead of an HTTP header.
 *
 * Only proves *who* is calling. Use `authorize()` (lib/authz.ts), which
 * calls this and then checks the account is still active and allowed to
 * perform the action.
 */
export function requireAuth(call: grpc.ServerUnaryCall<unknown, unknown>): JwtPayload {
  const raw = call.metadata.get('authorization')[0];
  const header = typeof raw === 'string' ? raw : raw?.toString('utf8');

  if (!header || !header.startsWith('Bearer ')) {
    throw AppError.from(ErrorCode.AUTH_TOKEN_MISSING, 401);
  }

  try {
    return verifyJwt(header.slice('Bearer '.length));
  } catch {
    // Expired, tampered, wrong algorithm or wrong shape — all mean "sign in again".
    throw AppError.from(ErrorCode.AUTH_TOKEN_INVALID, 401);
  }
}
