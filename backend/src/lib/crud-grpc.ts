import * as grpc from '@grpc/grpc-js';
import { requireAuth } from './grpc-auth.js';
import { AppError } from '../common/errors/app-error.js';
import { ErrorFilter } from '../common/errors/error-response.interface.js';

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

interface CrudLike {
  // `any` here (not Record<string, unknown>) so modules with a narrower,
  // specific DTO type (CreateUserDto, CreateInvoiceDto, ...) still satisfy
  // this shape — the gRPC layer only ever forwards call.request into it.
  create(dto: any): Promise<unknown>;
  findAll(): Promise<unknown[]>;
  findOne(id: number): Promise<unknown>;
  update(id: number, dto: any): Promise<unknown>;
  remove(id: number): Promise<unknown>;
}

/**
 * Recursively converts a Prisma row into gRPC/protobuf-safe values:
 * Decimal -> string (arbitrary precision, no float rounding across the
 * wire), Date -> ISO string, nested objects/arrays walked the same way.
 * Used as the default `mapOut` for every generated handler, and reusable
 * by hand-written services that return their own shaped rows.
 */
export function serialize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    const maybeDecimal = value as { toNumber?: unknown; toFixed?: unknown; toString: () => string };
    if (typeof maybeDecimal.toNumber === 'function' && typeof maybeDecimal.toFixed === 'function') {
      return maybeDecimal.toString();
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = serialize(v);
    return out;
  }
  return value;
}

/**
 * Builds the standard List/Get/Create/Update/Delete gRPC handlers for a
 * CrudService-shaped module (see common/crud/crud.service.ts). Every RPC
 * requires a valid JWT (same as the legacy REST controllers' @UseGuards
 * (JwtAuthGuard)); `mapOut` reshapes a Prisma row into its proto message
 * shape when the two don't line up field-for-field (e.g. optional fields).
 */
export function createCrudGrpcHandlers(
  service: CrudLike,
  opts: { listKey: string; mapOut?: (row: any) => any } = { listKey: 'items' },
): grpc.UntypedServiceImplementation {
  const mapOut = opts.mapOut ?? ((row: any) => serialize(row));

  return {
    create: async (call: Call, callback: Callback<any>) => {
      try {
        requireAuth(call);
        const result = await service.create(call.request);
        callback(null, mapOut(result));
      } catch (error) {
        fail(callback, error);
      }
    },
    list: async (call: Call, callback: Callback<any>) => {
      try {
        requireAuth(call);
        const rows = await service.findAll();
        callback(null, { [opts.listKey]: rows.map(mapOut) });
      } catch (error) {
        fail(callback, error);
      }
    },
    get: async (call: Call, callback: Callback<any>) => {
      try {
        requireAuth(call);
        const row = await service.findOne(call.request.id);
        callback(null, mapOut(row));
      } catch (error) {
        fail(callback, error);
      }
    },
    update: async (call: Call, callback: Callback<any>) => {
      try {
        requireAuth(call);
        const { id, ...rest } = call.request;
        const result = await service.update(id, rest);
        callback(null, mapOut(result));
      } catch (error) {
        fail(callback, error);
      }
    },
    delete: async (call: Call, callback: Callback<any>) => {
      try {
        requireAuth(call);
        await service.remove(call.request.id);
        callback(null, {});
      } catch (error) {
        fail(callback, error);
      }
    },
  };
}
