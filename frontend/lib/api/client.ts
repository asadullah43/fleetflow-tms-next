'use client';

import { GrpcWebClientBase, MethodDescriptor, MethodType, Metadata, RpcError } from 'grpc-web';
import { fleetflow } from '../generated/proto/messages.js';
import { ApiError, CONNECTION_ERROR_MESSAGE, ErrorFilter } from './errors';

// Points at the Envoy grpc-web proxy (see envoy/envoy.yaml), NOT the
// backend's native gRPC port directly — browsers can't speak raw gRPC.
const GRPC_WEB_URL = process.env.NEXT_PUBLIC_GRPC_WEB_URL ?? 'http://localhost:8080';

const transport = new GrpcWebClientBase({ format: 'binary' });
const { ApiResponse } = fleetflow.common;

/** A generated protobufjs message class. */
export interface MessageType<T = object> {
  create(properties?: Record<string, unknown>): T;
  encode(message: T): { finish(): Uint8Array };
  decode(bytes: Uint8Array): T;
}

// ── Session + global reactions, registered once by the session provider ──
let currentToken: string | null = null;
let handlers: { onUnauthenticated?: (error: ApiError) => void; onRateLimited?: (error: ApiError) => void } = {};

/** The session provider keeps this in step with the signed-in user; API modules never handle tokens themselves. */
export function setAuthToken(token: string | null): void {
  currentToken = token;
}

export function setApiEventHandlers(next: typeof handlers): void {
  handlers = next;
}

/** "fleetflow.trucks.TruckList" -> the generated class, so DB_DATA is decoded as exactly the type the backend says it is. */
function resolveType(typeName: string): MessageType {
  const found = typeName.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], { fleetflow });
  if (!found || typeof (found as MessageType).decode !== 'function') {
    throw new ApiError({ code: 'CLIENT-TYPE', filter: 'TECHNICAL_ISSUE', message: 'The server sent a response this version of the app does not understand. Please refresh the page.' });
  }
  return found as MessageType;
}

export interface CallOptions<Req> {
  /** e.g. "fleetflow.trucks.TrucksService" */
  service: string;
  /** e.g. "List" */
  method: string;
  RequestType: MessageType<Req>;
  request?: Record<string, unknown>;
  /** Sent as `idempotency-key`: a repeat of the same create returns the first result instead of creating twice. */
  idempotencyKey?: string;
  /** Use this token instead of the session's (sign-in bootstrap), or `null` to call anonymously. */
  token?: string | null;
}

/**
 * The single way the app talks to the backend. Sends one rpc, unwraps
 * the standard response envelope and returns DB_DATA decoded as its
 * declared type — or throws an ApiError carrying the backend's
 * ERROR_CODE / ERROR_FILTER / ERROR_DESCRIPTION.
 *
 * Session expiry and rate limiting are reported to the app-wide handlers
 * here, so no screen has to deal with them individually.
 */
export function apiCall<Res = unknown, Req = object>(options: CallOptions<Req>): Promise<Res> {
  const { service, method, RequestType } = options;
  const token = options.token === undefined ? currentToken : options.token;

  const descriptor = new MethodDescriptor<Req, fleetflow.common.ApiResponse>(
    `/${service}/${method}`,
    MethodType.UNARY,
    RequestType as unknown as new (...args: unknown[]) => Req,
    ApiResponse as unknown as new (...args: unknown[]) => fleetflow.common.ApiResponse,
    (request: Req) => RequestType.encode(request).finish(),
    (bytes: Uint8Array) => ApiResponse.decode(bytes),
  );

  const metadata: Metadata = {};
  if (token) metadata.authorization = `Bearer ${token}`;
  if (options.idempotencyKey) metadata['idempotency-key'] = options.idempotencyKey;

  return new Promise<Res>((resolve, reject) => {
    transport.rpcCall(`${GRPC_WEB_URL}/${service}/${method}`, RequestType.create(options.request ?? {}), metadata, descriptor, (transportError: RpcError, envelope) => {
      if (transportError) {
        // The backend itself never answers with a gRPC error: this is the network, the proxy, or the backend being down.
        reject(new ApiError({ code: 'CLIENT-NETWORK', filter: 'TECHNICAL_ISSUE', message: CONNECTION_ERROR_MESSAGE, transport: true }));
        return;
      }

      if (envelope.STATUS === 'SUCCESSFUL') {
        try {
          resolve(resolveType(envelope.DB_DATA_TYPE).decode(envelope.DB_DATA) as Res);
        } catch (error) {
          reject(error);
        }
        return;
      }

      const limit = envelope.RATE_LIMIT;
      const error = new ApiError({
        code: envelope.ERROR_CODE,
        filter: envelope.ERROR_FILTER as ErrorFilter,
        message: envelope.ERROR_DESCRIPTION,
        rateLimit: limit ? { type: limit.type ?? '', retryAfterSeconds: limit.retryAfterSeconds ?? 0, remainingPoints: limit.remainingPoints ?? 0 } : undefined,
      });
      // A rejected *session* ends it everywhere; a failed sign-in attempt (no token sent) is just an error for the login form.
      if (error.filter === 'USER_NOT_AUTHENTICATED' && token) handlers.onUnauthenticated?.(error);
      if (error.filter === 'RATE_LIMIT_EXCEEDED') handlers.onRateLimited?.(error);
      reject(error);
    });
  });
}
