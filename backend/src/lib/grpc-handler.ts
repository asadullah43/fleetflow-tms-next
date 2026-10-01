import * as grpc from '@grpc/grpc-js';
import { authorize, Access, Principal } from './authz.js';
import { sendError, OperationKind } from './grpc-errors.js';
import { serialize } from './serialize.js';

export { serialize };

type Call = grpc.ServerUnaryCall<any, any>;
type Callback = grpc.sendUnaryData<any>;

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
