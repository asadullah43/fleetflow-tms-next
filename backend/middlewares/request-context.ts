import crypto from 'node:crypto';
import type * as grpc from '@grpc/grpc-js';
import type { Principal } from '../models/auth-context.js';

/**
 * Everything a middleware or controller may need about one request.
 * Built by the router for each call and passed down the chain.
 */
export interface RequestContext<Input = any> {
  /** "package.Service/Method" — the operation name used in logs, idempotency and docs. */
  rpc: string;
  requestId: string;
  startedAt: number;
  /** Client address as reported by the reverse proxy (X-Real-IP / last X-Forwarded-For hop), else the gRPC peer. */
  ip: string;
  metadata: grpc.Metadata;
  /** The decoded request message as sent by the client. */
  request: unknown;
  /** The request after validation (unknown fields stripped, defaults applied). Controllers read this. */
  input: Input;
  /** Set by the authentication middleware; null on public routes. */
  principal: Principal | null;
}

export type Next = () => Promise<unknown>;
export type Middleware = (ctx: RequestContext, next: Next) => Promise<unknown>;
export type Controller<Input = any> = (ctx: RequestContext<Input>) => Promise<unknown>;

/** First value of a metadata key as a string, or undefined. */
export function header(metadata: grpc.Metadata, name: string): string | undefined {
  const raw = metadata.get(name)[0];
  if (raw === undefined) return undefined;
  return typeof raw === 'string' ? raw : raw.toString('utf8');
}

export function createContext(rpc: string, call: grpc.ServerUnaryCall<unknown, unknown>): RequestContext {
  // nginx sets X-Real-IP to the address it saw (overwriting anything the client sent), and appends that same
  // address to X-Forwarded-For — so the *last* hop is trustworthy while the first is whatever the client claimed.
  const forwarded = header(call.metadata, 'x-real-ip')?.trim() || header(call.metadata, 'x-forwarded-for')?.split(',').pop()?.trim();
  return {
    rpc,
    requestId: header(call.metadata, 'x-request-id') ?? crypto.randomUUID(),
    startedAt: Date.now(),
    ip: forwarded || call.getPeer(),
    metadata: call.metadata,
    request: call.request,
    input: call.request,
    principal: null,
  };
}

/** Runs `middlewares` in order, ending in `controller`. */
export function compose(middlewares: Middleware[], controller: Controller): (ctx: RequestContext) => Promise<unknown> {
  return (ctx) => {
    const dispatch = (index: number): Promise<unknown> =>
      index === middlewares.length ? controller(ctx) : middlewares[index](ctx, () => dispatch(index + 1));
    return dispatch(0);
  };
}
