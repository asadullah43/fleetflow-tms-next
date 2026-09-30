import * as grpc from '@grpc/grpc-js';
import { createCrudGrpcHandlers, serialize } from '../../lib/crud-grpc.js';
import { requireAuth } from '../../lib/grpc-auth.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorFilter } from '../../common/errors/error-response.interface.js';
import {
  workOrdersService,
  maintenanceSchedulesService,
  vehicleInspectionsService,
  sparePartsService,
  workshopExpensesService,
  workOrderPartsService,
  inspectionItemsService,
  sparePartTransactionsService,
} from './workshop.services.js';

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

export const workOrdersGrpcImpl = createCrudGrpcHandlers(workOrdersService, { listKey: 'items' });
export const maintenanceSchedulesGrpcImpl = createCrudGrpcHandlers(maintenanceSchedulesService, { listKey: 'items' });
export const vehicleInspectionsGrpcImpl = createCrudGrpcHandlers(vehicleInspectionsService, { listKey: 'items' });
export const sparePartsGrpcImpl = createCrudGrpcHandlers(sparePartsService, { listKey: 'items' });
export const workshopExpensesGrpcImpl = createCrudGrpcHandlers(workshopExpensesService, { listKey: 'items' });

/** Line-item tables (no Get RPC — list/create/update/delete only, or a subset of those). */
export const workOrderPartsGrpcImpl: grpc.UntypedServiceImplementation = {
  list: async (_call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      const rows = await workOrderPartsService.findAll();
      callback(null, { items: serialize(rows) });
    } catch (error) {
      fail(callback, error);
    }
  },
  create: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      requireAuth(call);
      const row = await workOrderPartsService.create(call.request);
      callback(null, serialize(row));
    } catch (error) {
      fail(callback, error);
    }
  },
  update: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      requireAuth(call);
      const { id, ...rest } = call.request;
      const row = await workOrderPartsService.update(id, rest);
      callback(null, serialize(row));
    } catch (error) {
      fail(callback, error);
    }
  },
  delete: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      requireAuth(call);
      await workOrderPartsService.remove(call.request.id);
      callback(null, {});
    } catch (error) {
      fail(callback, error);
    }
  },
};

export const inspectionItemsGrpcImpl: grpc.UntypedServiceImplementation = {
  list: async (_call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      const rows = await inspectionItemsService.findAll();
      callback(null, { items: serialize(rows) });
    } catch (error) {
      fail(callback, error);
    }
  },
  create: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      requireAuth(call);
      const row = await inspectionItemsService.create(call.request);
      callback(null, serialize(row));
    } catch (error) {
      fail(callback, error);
    }
  },
  update: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      requireAuth(call);
      const { id, ...rest } = call.request;
      const row = await inspectionItemsService.update(id, rest);
      callback(null, serialize(row));
    } catch (error) {
      fail(callback, error);
    }
  },
  delete: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      requireAuth(call);
      await inspectionItemsService.remove(call.request.id);
      callback(null, {});
    } catch (error) {
      fail(callback, error);
    }
  },
};

export const sparePartTransactionsGrpcImpl: grpc.UntypedServiceImplementation = {
  list: async (_call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      const rows = await sparePartTransactionsService.findAll();
      callback(null, { items: serialize(rows) });
    } catch (error) {
      fail(callback, error);
    }
  },
  create: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      requireAuth(call);
      const row = await sparePartTransactionsService.create(call.request);
      callback(null, serialize(row));
    } catch (error) {
      fail(callback, error);
    }
  },
  delete: async (call: grpc.ServerUnaryCall<any, any>, callback: Callback<any>) => {
    try {
      requireAuth(call);
      await sparePartTransactionsService.remove(call.request.id);
      callback(null, {});
    } catch (error) {
      fail(callback, error);
    }
  },
};
