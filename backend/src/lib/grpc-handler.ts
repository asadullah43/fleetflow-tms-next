import * as grpc from '@grpc/grpc-js';
import { authorize, Access, Principal } from './authz.js';
import { sendError, OperationKind } from './grpc-errors.js';

type Call = grpc.ServerUnaryCall<any, any>;
type Callback = grpc.sendUnaryData<any>;

/**
 * Recursively converts a Prisma row into gRPC/protobuf-safe values:
 * Decimal -> string (arbitrary precision, no float rounding across the
 * wire), Date -> ISO string, nested objects/arrays walked the same way.
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
 * The one way an RPC handler is built: authorize per `access`, run `fn`,
 * serialize the result, and turn any failure into the client-facing gRPC
 * error. Replaces the try/requireAuth/catch/fail block every module used
 * to copy, so no RPC can forget the permission check.
 */
export function rpc<Req = any>(
  access: Access,
  fn: (request: Req, principal: Principal | null) => Promise<unknown>,
  op: OperationKind = 'write',
): grpc.handleUnaryCall<Req, any> {
  return async (call: Call, callback: Callback) => {
    try {
      const principal = await authorize(call, access);
      const result = await fn(call.request as Req, principal);
      callback(null, serialize(result ?? {}));
    } catch (error) {
      sendError(callback, error, op);
    }
  };
}
