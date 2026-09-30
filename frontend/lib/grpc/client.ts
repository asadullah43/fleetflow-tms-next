'use client';

import { GrpcWebClientBase, MethodDescriptor, MethodType, Metadata, RpcError } from 'grpc-web';

// Points at the Envoy grpc-web proxy (see envoy/envoy.yaml), NOT the
// backend's native gRPC port directly — browsers can't speak raw gRPC.
const GRPC_WEB_URL = process.env.NEXT_PUBLIC_GRPC_WEB_URL ?? 'http://localhost:8080';

const client = new GrpcWebClientBase({ format: 'binary' });

interface ProtobufjsType<T> {
  encode(message: T): { finish(): Uint8Array };
  decode(bytes: Uint8Array): T;
}

/**
 * Generic unary-RPC caller built on protobufjs message classes (encode/
 * decode) + grpc-web's transport. Every module's frontend client
 * (auth, trucks, drivers, ...) is a thin set of calls through this same
 * function — no per-module boilerplate beyond naming the proto types.
 */
export function unaryCall<Req, Res>(opts: {
  serviceName: string; // e.g. "fleetflow.auth.AuthService"
  methodName: string; // e.g. "Login"
  request: Req;
  RequestType: ProtobufjsType<Req>;
  ResponseType: ProtobufjsType<Res>;
  token?: string | null;
}): Promise<Res> {
  const { serviceName, methodName, request, RequestType, ResponseType, token } = opts;

  const methodDescriptor = new MethodDescriptor<Req, Res>(
    `/${serviceName}/${methodName}`,
    MethodType.UNARY,
    RequestType as unknown as new (...args: unknown[]) => Req,
    ResponseType as unknown as new (...args: unknown[]) => Res,
    (req: Req) => RequestType.encode(req).finish(),
    (bytes: Uint8Array) => ResponseType.decode(bytes),
  );

  const metadata: Metadata = token ? { authorization: `Bearer ${token}` } : {};

  return new Promise<Res>((resolve, reject) => {
    client.rpcCall<Req, Res>(
      `${GRPC_WEB_URL}/${serviceName}/${methodName}`,
      request,
      metadata,
      methodDescriptor,
      (err: RpcError, response: Res) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(response);
      },
    );
  });
}

export type { RpcError };
