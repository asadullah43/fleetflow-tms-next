import * as grpc from '@grpc/grpc-js';
import { loadingOrdersService } from './loading-orders.service.js';
import { requireAuth } from '../../lib/grpc-auth.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorFilter } from '../../common/errors/error-response.interface.js';

type Callback<T> = grpc.sendUnaryData<T>;
type Call = grpc.ServerUnaryCall<any, any>;

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

export const loadingOrdersGrpcImpl: grpc.UntypedServiceImplementation = {
  listGrouped: async (call: Call, callback: Callback<any>) => {
    try {
      requireAuth(call);
      const items = await loadingOrdersService.findAllGrouped();
      callback(null, { items });
    } catch (error) {
      fail(callback, error);
    }
  },
  getBatch: async (call: Call, callback: Callback<any>) => {
    try {
      requireAuth(call);
      const items = await loadingOrdersService.findByBatch(call.request.batchId);
      callback(null, { items });
    } catch (error) {
      fail(callback, error);
    }
  },
  create: async (call: Call, callback: Callback<any>) => {
    try {
      requireAuth(call);
      const items = await loadingOrdersService.create(call.request);
      callback(null, { items });
    } catch (error) {
      fail(callback, error);
    }
  },
  deleteBatch: async (call: Call, callback: Callback<any>) => {
    try {
      requireAuth(call);
      await loadingOrdersService.removeBatch(call.request.batchId);
      callback(null, {});
    } catch (error) {
      fail(callback, error);
    }
  },
};
