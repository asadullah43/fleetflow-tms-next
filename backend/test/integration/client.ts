/**
 * Minimal native-gRPC client for the integration suite: loads the same
 * proto files the server does, calls a running backend and unwraps the
 * standard ApiResponse envelope. Point it at a backend with
 * INTEGRATION_GRPC_ADDR (e.g. 127.0.0.1:50051); the suite is skipped
 * when that isn't set. Never point it at production: it creates data.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import protobuf from 'protobufjs';

const PROTO_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../proto');
const PROTO_FILES = fs.readdirSync(PROTO_DIR).filter((f) => f.endsWith('.proto'));

export const ADDR = process.env.INTEGRATION_GRPC_ADDR;
export const ADMIN_USER = process.env.INTEGRATION_ADMIN_USER ?? 'admin';
export const ADMIN_PASSWORD = process.env.INTEGRATION_ADMIN_PASSWORD ?? 'Admin123!';
export const SKIP = !ADDR && 'set INTEGRATION_GRPC_ADDR to run';

const definition = protoLoader.loadSync(PROTO_FILES, { keepCase: false, longs: Number, enums: String, defaults: true, oneofs: true, includeDirs: [PROTO_DIR] });
const services = grpc.loadPackageDefinition(definition).fleetflow as any;

const types = new protobuf.Root();
types.resolvePath = (_origin, target) => (path.isAbsolute(target) ? target : path.join(PROTO_DIR, target));
types.loadSync(PROTO_FILES);

export interface ApiFailure {
  errorCode: string;
  errorFilter: string;
  description: string;
  rateLimit?: { type: string; retryAfterSeconds: number; remainingPoints: number };
}

export interface CallResult<T = any> {
  ok?: T;
  err?: ApiFailure;
  /** Top-level keys of the envelope as received, for contract assertions. */
  envelope: Record<string, unknown>;
}

/** A bearer token, or explicit credentials / headers. */
export type Auth = string | { token?: string; apiKey?: string; idempotencyKey?: string } | undefined;

export function client(pkg: string, service: string): any {
  return new services[pkg][service](ADDR, grpc.credentials.createInsecure());
}

export function call<T = any>(svc: any, method: string, request: object, auth?: Auth): Promise<CallResult<T>> {
  const options = typeof auth === 'string' ? { token: auth } : (auth ?? {});
  const metadata = new grpc.Metadata();
  if (options.token) metadata.set('authorization', `Bearer ${options.token}`);
  if (options.apiKey) metadata.set('x-api-key', options.apiKey);
  if (options.idempotencyKey) metadata.set('idempotency-key', options.idempotencyKey);

  return new Promise((resolve, reject) => {
    svc[method](request, metadata, (error: grpc.ServiceError | null, response: any) => {
      // Application errors arrive inside the envelope; a gRPC-level error means the transport itself failed.
      if (error) return reject(error);
      if (response.STATUS === 'SUCCESSFUL') {
        const type = types.lookupType(response.DB_DATA_TYPE);
        const ok = type.toObject(type.decode(response.DB_DATA), { longs: Number, defaults: true, arrays: true }) as T;
        return resolve({ ok, envelope: response });
      }
      resolve({
        err: { errorCode: response.ERROR_CODE, errorFilter: response.ERROR_FILTER, description: response.ERROR_DESCRIPTION, rateLimit: response.RATE_LIMIT ?? undefined },
        envelope: response,
      });
    });
  });
}

/** Unwraps a successful call or fails the test with the server's message. */
export function must<T>(result: CallResult<T>): T {
  if (result.err) throw new Error(`RPC failed: ${result.err.errorFilter} ${result.err.errorCode} ${result.err.description}`);
  return result.ok as T;
}

export async function loginAs(username: string, password: string): Promise<string> {
  return must(await call(client('auth', 'AuthService'), 'login', { username, password })).accessToken;
}

export const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;
