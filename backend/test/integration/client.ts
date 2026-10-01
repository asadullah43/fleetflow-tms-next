/**
 * Minimal native-gRPC client for the integration suite: loads the same
 * proto files the server does and calls a running backend. Point it at
 * one with INTEGRATION_GRPC_ADDR (e.g. 127.0.0.1:50051); the suite is
 * skipped when that isn't set.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const PROTO_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../proto');

export const ADDR = process.env.INTEGRATION_GRPC_ADDR;
export const ADMIN_USER = process.env.INTEGRATION_ADMIN_USER ?? 'admin';
export const ADMIN_PASSWORD = process.env.INTEGRATION_ADMIN_PASSWORD ?? 'Admin123!';

const definition = protoLoader.loadSync(
  fs.readdirSync(PROTO_DIR).filter((f) => f.endsWith('.proto')),
  { keepCase: false, longs: Number, enums: String, defaults: true, oneofs: true, includeDirs: [PROTO_DIR] },
);
const root = grpc.loadPackageDefinition(definition).fleetflow as any;

export interface CallResult<T = any> {
  ok?: T;
  err?: { code: string; details: string; errorCode?: string };
}

export function client(pkg: string, service: string): any {
  return new root[pkg][service](ADDR, grpc.credentials.createInsecure());
}

export function call<T = any>(svc: any, method: string, request: object, token?: string): Promise<CallResult<T>> {
  const metadata = new grpc.Metadata();
  if (token) metadata.set('authorization', `Bearer ${token}`);
  return new Promise((resolve) => {
    svc[method](request, metadata, (error: grpc.ServiceError | null, response: T) => {
      if (!error) return resolve({ ok: response });
      const envelope = error.metadata?.get('app-error-bin')?.[0];
      resolve({
        err: {
          code: grpc.status[error.code],
          details: error.details,
          errorCode: envelope ? JSON.parse(envelope.toString()).ERROR_CODE : undefined,
        },
      });
    });
  });
}

/** Unwraps a successful call or fails the test with the server's message. */
export function must<T>(result: CallResult<T>): T {
  if (result.err) throw new Error(`RPC failed: ${result.err.code} ${result.err.errorCode ?? ''} ${result.err.details}`);
  return result.ok as T;
}

export async function loginAs(username: string, password: string): Promise<string> {
  return must(await call(client('auth', 'AuthService'), 'login', { username, password })).accessToken;
}
