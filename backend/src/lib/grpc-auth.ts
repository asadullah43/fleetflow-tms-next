import * as grpc from '@grpc/grpc-js';
import { verifyJwt, JwtPayload } from './jwt.js';
import { AppError } from '../common/errors/app-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';

/**
 * gRPC equivalent of the legacy JwtAuthGuard: reads the bearer token from
 * call metadata ("authorization: Bearer <jwt>") instead of an HTTP header.
 * Every authenticated RPC handler calls this first, same as Nest's
 * @UseGuards(JwtAuthGuard) did for REST routes.
 */
export function requireAuth(call: grpc.ServerUnaryCall<unknown, unknown>): JwtPayload {
  const raw = call.metadata.get('authorization')[0];
  const header = typeof raw === 'string' ? raw : raw?.toString('utf8');

  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError({
      errorCode: ErrorCode.AUTH_TOKEN_MISSING.code,
      errorFilter: ErrorCode.AUTH_TOKEN_MISSING.filter,
      errorDescription: ErrorCode.AUTH_TOKEN_MISSING.description,
      statusCode: 401,
    });
  }

  const token = header.slice('Bearer '.length);

  try {
    return verifyJwt(token);
  } catch {
    throw new AppError({
      errorCode: ErrorCode.AUTH_TOKEN_MISSING.code,
      errorFilter: ErrorCode.AUTH_TOKEN_MISSING.filter,
      errorDescription: ErrorCode.AUTH_TOKEN_MISSING.description,
      statusCode: 401,
    });
  }
}
