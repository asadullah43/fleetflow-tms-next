import * as grpc from '@grpc/grpc-js';
import { authService } from './auth.service.js';
import { requireAuth } from '../../lib/grpc-auth.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorFilter } from '../../common/errors/error-response.interface.js';

type Callback<T> = grpc.sendUnaryData<T>;

/** Converts any thrown error into the gRPC error shape the client expects. */
function fail(callback: Callback<unknown>, error: unknown): void {
  if (error instanceof AppError) {
    callback(error.toGrpcServiceError(), null);
    return;
  }
  const unexpected = new AppError({
    errorCode: 'FLEET-SYS001',
    errorFilter: ErrorFilter.TECHNICAL_ISSUE,
    errorDescription: 'Something went wrong. Please try again.',
    statusCode: 500,
    cause: error as Error,
  });
  callback(unexpected.toGrpcServiceError(), null);
}

/**
 * gRPC service implementation for auth.proto's AuthService — the direct
 * replacement for AuthController in the legacy NestJS app. One handler
 * per RPC, same behavior, same error codes, different transport.
 */
export const authGrpcImpl: grpc.UntypedServiceImplementation = {
  login: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      const { username, password, language } = call.request;
      const result = await authService.login(username, password, language || undefined);
      callback(null, result);
    } catch (error) {
      fail(callback, error);
    }
  },

  getMe: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      const auth = requireAuth(call);
      const result = await authService.getMe(auth.sub);
      callback(null, result);
    } catch (error) {
      fail(callback, error);
    }
  },

  updateLanguage: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      const auth = requireAuth(call);
      const result = await authService.updateLanguage(auth.sub, call.request.language);
      callback(null, result);
    } catch (error) {
      fail(callback, error);
    }
  },

  getMyPermissions: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      const auth = requireAuth(call);
      const permissions = await authService.getPermissionsForRole(auth.roleId);
      callback(null, { permissions });
    } catch (error) {
      fail(callback, error);
    }
  },
};
