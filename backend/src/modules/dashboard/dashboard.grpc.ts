import * as grpc from '@grpc/grpc-js';
import { dashboardService } from './dashboard.service.js';
import { requireAuth } from '../../lib/grpc-auth.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { ErrorFilter } from '../../common/errors/error-response.interface.js';

type Callback<T> = grpc.sendUnaryData<T>;

export const dashboardGrpcImpl: grpc.UntypedServiceImplementation = {
  getSummary: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      requireAuth(call);
      const summary = await dashboardService.getSummary();
      callback(null, summary);
    } catch (error) {
      if (error instanceof AppError) {
        callback(error.toGrpcServiceError(), null);
        return;
      }
      const unexpected = new AppError({
        errorCode: ErrorCode.DSH_FETCH_FAILED.code,
        errorFilter: ErrorFilter.TECHNICAL_ISSUE,
        errorDescription: ErrorCode.DSH_FETCH_FAILED.description,
        statusCode: 500,
        cause: error as Error,
      });
      callback(unexpected.toGrpcServiceError(), null);
    }
  },
};
