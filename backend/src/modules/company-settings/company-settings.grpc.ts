import * as grpc from '@grpc/grpc-js';
import { companySettingsService } from './company-settings.service.js';
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

export const companySettingsGrpcImpl: grpc.UntypedServiceImplementation = {
  get: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      requireAuth(call);
      const row = await companySettingsService.getOrCreate();
      callback(null, serialize(row));
    } catch (error) {
      fail(callback, error);
    }
  },
  update: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      requireAuth(call);
      const row = await companySettingsService.update(call.request);
      callback(null, serialize(row));
    } catch (error) {
      fail(callback, error);
    }
  },
};
