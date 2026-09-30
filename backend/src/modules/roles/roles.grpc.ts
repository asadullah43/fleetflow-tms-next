import * as grpc from '@grpc/grpc-js';
import { rolesService } from './roles.service.js';
import { requireAuth } from '../../lib/grpc-auth.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorFilter } from '../../common/errors/error-response.interface.js';
import { serialize } from '../../lib/crud-grpc.js';

type Callback<T> = grpc.sendUnaryData<T>;

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

export const rolesGrpcImpl: grpc.UntypedServiceImplementation = {
  list: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      requireAuth(call);
      const rows = await rolesService.findAll();
      callback(null, { items: serialize(rows) });
    } catch (error) {
      fail(callback, error);
    }
  },
  get: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      requireAuth(call);
      const row = await rolesService.findOne(call.request.id);
      callback(null, serialize(row));
    } catch (error) {
      fail(callback, error);
    }
  },
  create: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      requireAuth(call);
      const row = await rolesService.create(call.request);
      callback(null, serialize(row));
    } catch (error) {
      fail(callback, error);
    }
  },
  update: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      requireAuth(call);
      const { id, ...rest } = call.request;
      const row = await rolesService.update(id, rest);
      callback(null, serialize(row));
    } catch (error) {
      fail(callback, error);
    }
  },
  delete: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      requireAuth(call);
      await rolesService.remove(call.request.id);
      callback(null, {});
    } catch (error) {
      fail(callback, error);
    }
  },
  getPermissionModules: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      requireAuth(call);
      callback(null, { modules: rolesService.getPermissionModules() });
    } catch (error) {
      fail(callback, error);
    }
  },
};
