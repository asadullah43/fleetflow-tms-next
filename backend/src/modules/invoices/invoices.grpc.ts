import * as grpc from '@grpc/grpc-js';
import { createCrudGrpcHandlers, serialize } from '../../lib/crud-grpc.js';
import { requireAuth } from '../../lib/grpc-auth.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorFilter } from '../../common/errors/error-response.interface.js';
import { invoicesService } from './invoices.service.js';

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

const base = createCrudGrpcHandlers(invoicesService, { listKey: 'items' });

export const invoicesGrpcImpl: grpc.UntypedServiceImplementation = {
  ...base,
  markPaid: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      requireAuth(call);
      const row = await invoicesService.markPaid(call.request.id);
      callback(null, serialize(row));
    } catch (error) {
      fail(callback, error);
    }
  },
  submitToZatca: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      requireAuth(call);
      const row = await invoicesService.submitToZatca(call.request.id);
      callback(null, serialize(row));
    } catch (error) {
      fail(callback, error);
    }
  },
};
