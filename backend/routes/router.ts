/**
 * Turns route tables into a gRPC service implementation.
 *
 * Every route is a middleware chain ending in a controller:
 *
 *   rate limit (IP) → [authenticate → authorize → validate → idempotency] → controller → service
 *
 * and every outcome — success or failure — leaves as the standard
 * ApiResponse envelope, with one structured log line per request.
 */
import { trackRequestWrites } from '../_core_app_connectivities/cache.js';
import type * as grpc from '@grpc/grpc-js';
import { encodePayload } from '../_core_app_connectivities/grpc-proto.js';
import { OperationKind, toAppError } from '../middlewares/error-handler.js';
import { rateLimitByIp } from '../middlewares/rate-limit.js';
import { compose, Controller, createContext, Middleware, RequestContext } from '../middlewares/request-context.js';
import { stripOneofMarkers } from '../utils/grpc-sanitize.js';
import { logger } from '../utils/logger.js';
import { serialize } from '../utils/serialize.js';

export interface RouteDefinition {
  /** Fully-qualified proto message type of DB_DATA on success. */
  data: string;
  op: OperationKind;
  middlewares: Middleware[];
  controller: Controller;
}

export type RouteTable = Record<string, RouteDefinition>;
/** "package.Service" -> its routes. Each routes/*.routes.ts file exports one of these. */
export type ServiceRoutes = Record<string, RouteTable>;

/** `route(dataType, op, ...middlewares, controller)` */
export function route(data: string, op: OperationKind, ...chain: [...Middleware[], Controller]): RouteDefinition {
  const controller = chain[chain.length - 1] as Controller;
  const middlewares = chain.slice(0, -1) as Middleware[];
  return { data, op, middlewares, controller };
}

/** Middleware every route gets, in front of its own. */
const GLOBAL_MIDDLEWARES: Middleware[] = [rateLimitByIp];

export function logRequest(ctx: RequestContext, outcome: { status: 'SUCCESSFUL' | 'ERROR'; errorCode?: string; statusCode?: number; cause?: unknown }): void {
  const fields = {
    requestId: ctx.requestId,
    rpc: ctx.rpc,
    status: outcome.status,
    errorCode: outcome.errorCode,
    durationMs: Date.now() - ctx.startedAt,
    authMethod: ctx.principal?.authMethod,
    companyId: ctx.principal?.companyId,
    userId: ctx.principal?.userId ?? undefined,
    apiKeyId: ctx.principal?.apiKeyId ?? undefined,
  };
  if (outcome.status === 'SUCCESSFUL') logger.info('request', fields);
  else if ((outcome.statusCode ?? 500) >= 500) logger.error('request failed', { ...fields, error: outcome.cause });
  else logger.warn('request rejected', fields);
}

export function buildService(serviceName: string, routes: RouteTable): grpc.UntypedServiceImplementation {
  const implementation: grpc.UntypedServiceImplementation = {};

  for (const [method, definition] of Object.entries(routes)) {
    const rpc = `${serviceName}/${method}`;
    const run = compose([...GLOBAL_MIDDLEWARES, ...definition.middlewares], definition.controller);

    implementation[method] = async (call: grpc.ServerUnaryCall<unknown, unknown>, callback: grpc.sendUnaryData<unknown>) => {
      call.request = stripOneofMarkers(call.request);
      const ctx = createContext(rpc, call);
      try {
        // Writes are invalidated again once the request (and any transaction in it) has finished — before the response goes out.
        const result = await trackRequestWrites(() => run(ctx));
        const payload = encodePayload(definition.data, serialize(result ?? {}));
        logRequest(ctx, { status: 'SUCCESSFUL' });
        callback(null, { STATUS: 'SUCCESSFUL', ERROR_CODE: '', ERROR_FILTER: '', ERROR_DESCRIPTION: '', DB_DATA: payload, DB_DATA_TYPE: definition.data });
      } catch (error) {
        const appError = toAppError(error, definition.op);
        logRequest(ctx, { status: 'ERROR', errorCode: appError.errorCode, statusCode: appError.statusCode, cause: appError.cause ?? error });
        callback(null, { ...appError.toResponse(), DB_DATA: Buffer.alloc(0), DB_DATA_TYPE: '' });
      }
    };
  }
  return implementation;
}
