/**
 * PROTECTED CORE CONNECTIVITY — the proto contract, loaded once.
 *
 * - `grpcPackage`: service definitions for the gRPC server (request
 *   decoding / ApiResponse encoding is done by grpc-js from these).
 * - `encodePayload`: encodes a DB_DATA payload as the named proto message,
 *   so success data stays strongly typed inside the generic envelope.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import protobuf from 'protobufjs';
import { config } from '../global_config/index.js';

const protoDir = config.grpc.protoDir;
const protoFiles = fs
  .readdirSync(protoDir)
  .filter((file) => file.endsWith('.proto'))
  .sort();

const packageDefinition = protoLoader.loadSync(protoFiles, {
  keepCase: false, // camelCase field names on the JS side (canView, roleId, ...)
  longs: Number,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: [protoDir],
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- grpc's loaded package object is untyped by design
export const grpcPackage = grpc.loadPackageDefinition(packageDefinition) as any;

const root = new protobuf.Root();
root.resolvePath = (_origin, target) => (path.isAbsolute(target) ? target : path.join(protoDir, target));
root.loadSync(protoFiles);
root.resolveAll();

export function hasMessageType(typeName: string): boolean {
  try {
    root.lookupType(typeName);
    return true;
  } catch {
    return false;
  }
}

/** Every rpc of every service as "package.Service/Method", for route-coverage checks. */
export function listRpcs(): string[] {
  const rpcs: string[] = [];
  const walk = (ns: protobuf.NamespaceBase) => {
    for (const nested of ns.nestedArray) {
      if (nested instanceof protobuf.Service) {
        for (const method of nested.methodsArray) rpcs.push(`${nested.fullName.replace(/^\./, '')}/${method.name}`);
      } else if (nested instanceof protobuf.Namespace) walk(nested);
    }
  };
  walk(root);
  return rpcs;
}

export function encodePayload(typeName: string, data: unknown): Buffer {
  const type = root.lookupType(typeName);
  const message = type.fromObject((data ?? {}) as Record<string, unknown>);
  return Buffer.from(type.encode(message).finish());
}
