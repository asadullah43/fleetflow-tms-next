import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as grpc from '@grpc/grpc-js';
import protobuf from 'protobufjs';
import { z } from 'zod';

process.env.DATABASE_URL ??= 'postgresql://unused@127.0.0.1:1/unused';
process.env.JWT_SECRET ??= 'unit-test-secret';
const { AppError } = await import('../classes/app-error.js');
const { ErrorCode } = await import('../global_config/error-codes.js');
const { authorize, authorizeLookup, requireUserSession } = await import('../middlewares/authorization.js');
const { compose } = await import('../middlewares/request-context.js');
const { validate } = await import('../middlewares/validation.js');
const { buildService, route } = await import('../routes/router.js');
const { createTruckRequest, updateTruckRequest } = await import('../validations/trucks.validation.js');
const { createUserRequest } = await import('../validations/users.validation.js');
import type { Principal } from '../models/auth-context.js';
import type { RequestContext } from '../middlewares/request-context.js';

const flags = (canView = false, canAdd = false, canEdit = false, canDelete = false) => ({ canView, canAdd, canEdit, canDelete });
const user = (roleName: string | null, permissions: Principal['permissions'] = []): Principal => ({ authMethod: 'JWT', companyId: 1, userId: 5, apiKeyId: null, roleName, permissions });
const apiKey = (permissions: Principal['permissions']): Principal => ({ authMethod: 'API_KEY', companyId: 1, userId: null, apiKeyId: 9, roleName: null, permissions });
const ctx = (principal: Principal | null, request: unknown = {}): RequestContext =>
  ({ rpc: 'test/Test', requestId: 'r', startedAt: Date.now(), ip: '10.0.0.1', metadata: new grpc.Metadata(), request, input: request, principal }) as RequestContext;
const ok = async () => 'reached';
const codeOf = async (run: Promise<unknown>) => run.then(() => 'OK', (error) => (error as InstanceType<typeof AppError>).errorCode);

test('authorize: needs the exact flag; ADMIN bypasses; no principal is unauthenticated', async () => {
  const dispatcher = user('DISPATCHER', [{ module: 'trips', ...flags(true, true) }]);
  assert.equal(await authorize('trips', 'add')(ctx(dispatcher), ok), 'reached');
  assert.equal(await codeOf(authorize('trips', 'delete')(ctx(dispatcher), ok)), ErrorCode.AUTH_PERMISSION_DENIED.code);
  assert.equal(await codeOf(authorize('invoices', 'view')(ctx(dispatcher), ok)), ErrorCode.AUTH_PERMISSION_DENIED.code);
  assert.equal(await authorize('invoices', 'delete')(ctx(user('ADMIN')), ok), 'reached');
  assert.equal(await codeOf(authorize('trips', 'view')(ctx(null), ok)), ErrorCode.AUTH_TOKEN_MISSING.code);
});

test('an API key has only its scopes — never ADMIN, never a user', async () => {
  const key = apiKey([{ module: 'trips', ...flags(true) }]);
  assert.equal(await authorize('trips', 'view')(ctx(key), ok), 'reached');
  assert.equal(await codeOf(authorize('trips', 'add')(ctx(key), ok)), ErrorCode.AUTH_PERMISSION_DENIED.code);
  assert.equal(await codeOf(requireUserSession(ctx(key), ok)), ErrorCode.AUTH_PERMISSION_DENIED.code);
  assert.equal(await requireUserSession(ctx(user('DISPATCHER')), ok), 'reached');
});

test('lookup lists: any signed-in user may read; an API key still needs the view scope', async () => {
  assert.equal(await authorizeLookup('trucks')(ctx(user('DISPATCHER')), ok), 'reached');
  assert.equal(await codeOf(authorizeLookup('trucks')(ctx(apiKey([{ module: 'trips', ...flags(true) }])), ok)), ErrorCode.AUTH_PERMISSION_DENIED.code);
  assert.equal(await authorizeLookup('trucks')(ctx(apiKey([{ module: 'trucks', ...flags(true) }])), ok), 'reached');
});

test('validate: rejects bad input with a field-specific INVALID_REQUEST and strips unknown fields', async () => {
  const context = ctx(null, { truckNumber: 'T-1', companyId: 999, isAdmin: true });
  await validate(createTruckRequest)(context, ok);
  assert.equal(context.input.truckNumber, 'T-1');
  assert.equal('companyId' in context.input, false, 'a client-supplied companyId must never reach a service');
  assert.equal('isAdmin' in context.input, false);

  const failure = await validate(createTruckRequest)(ctx(null, { truckNumber: '   ' }), ok).catch((error: InstanceType<typeof AppError>) => error) as InstanceType<typeof AppError>;
  assert.equal(failure.errorCode, ErrorCode.SYS_VALIDATION_ERROR.code);
  assert.match(failure.errorDescription, /truckNumber/);
  assert.equal(await codeOf(validate(updateTruckRequest)(ctx(null, { id: 0 }), ok)), ErrorCode.SYS_VALIDATION_ERROR.code);
  assert.equal(await codeOf(validate(createUserRequest)(ctx(null, { name: 'A', email: 'not-an-email', password: 'x' }), ok)), ErrorCode.SYS_VALIDATION_ERROR.code);
});

test('compose runs middlewares in order and stops at the first failure', async () => {
  const order: string[] = [];
  const mark = (name: string) => async (_c: RequestContext, next: () => Promise<unknown>) => {
    order.push(name);
    return next();
  };
  const deny = async () => {
    throw AppError.from(ErrorCode.AUTH_PERMISSION_DENIED, 403);
  };
  assert.equal(await compose([mark('a'), mark('b')], async () => 'done')(ctx(null)), 'done');
  await assert.rejects(compose([mark('c'), deny, mark('never')], async () => 'done')(ctx(null)));
  assert.deepEqual(order, ['a', 'b', 'c']);
});

// ── The envelope, end to end through the router (no network, no database) ──
const ENVELOPE_KEYS = ['DB_DATA', 'DB_DATA_TYPE', 'ERROR_CODE', 'ERROR_DESCRIPTION', 'ERROR_FILTER', 'STATUS'];

function invoke(implementation: grpc.UntypedServiceImplementation, method: string, request: object): Promise<any> {
  const call = { request, metadata: new grpc.Metadata(), getPeer: () => `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}:1` };
  return new Promise((resolve, reject) => (implementation[method] as any)(call, (error: unknown, response: unknown) => (error ? reject(error) : resolve(response))));
}

test('success: STATUS SUCCESSFUL, empty error fields, DB_DATA is the typed proto message', async () => {
  const service = buildService('test.Service', {
    Get: route('fleetflow.trucks.Truck', 'read', async () => ({ id: 7, truckNumber: 'T-7', status: 'ACTIVE', createdAt: new Date('2026-01-01T00:00:00Z') })),
  });
  const response = await invoke(service, 'Get', {});
  assert.deepEqual(Object.keys(response).sort(), ENVELOPE_KEYS);
  assert.deepEqual([response.STATUS, response.ERROR_CODE, response.ERROR_FILTER, response.ERROR_DESCRIPTION], ['SUCCESSFUL', '', '', '']);
  assert.equal(response.DB_DATA_TYPE, 'fleetflow.trucks.Truck');

  const root = new protobuf.Root();
  const { config } = await import('../global_config/index.js');
  root.resolvePath = (_o, target) => `${config.grpc.protoDir}/${target.split('/').pop()}`;
  root.loadSync(['common.proto', 'trucks.proto']);
  const truck = root.lookupType('fleetflow.trucks.Truck').decode(response.DB_DATA) as unknown as { id: number; truckNumber: string };
  assert.equal(truck.id, 7);
  assert.equal(truck.truckNumber, 'T-7');
});

test('a thrown AppError becomes the error envelope — never a gRPC error', async () => {
  const service = buildService('test.Service', {
    Get: route('fleetflow.trucks.Truck', 'read', async () => {
      throw AppError.from(ErrorCode.TRK_NOT_FOUND, 404);
    }),
  });
  const response = await invoke(service, 'Get', {});
  assert.deepEqual(Object.keys(response).sort(), ENVELOPE_KEYS);
  assert.deepEqual([response.STATUS, response.ERROR_CODE, response.ERROR_FILTER], ['ERROR', 'FLEET-TRK001', 'INVALID_REQUEST']);
  assert.equal(response.DB_DATA.length, 0);
});

test('an unexpected crash becomes TECHNICAL_ISSUE and leaks nothing about the cause', async () => {
  const originalError = console.error;
  console.error = () => undefined; // the router logs the real cause; keep test output clean
  try {
    const service = buildService('test.Service', {
      Get: route('fleetflow.trucks.Truck', 'read', async () => {
        throw new Error('SELECT * FROM "User" failed at /app/services/secret.ts password=hunter2');
      }),
    });
    const response = await invoke(service, 'Get', {});
    assert.deepEqual([response.STATUS, response.ERROR_CODE, response.ERROR_FILTER], ['ERROR', 'FLEET-SYS001', 'TECHNICAL_ISSUE']);
    assert.doesNotMatch(JSON.stringify({ ...response, DB_DATA: undefined }), /SELECT|secret\.ts|hunter2/);
  } finally {
    console.error = originalError;
  }
});

test('validation failures from a real schema surface through the envelope', async () => {
  const service = buildService('test.Service', {
    Create: route('fleetflow.trucks.Truck', 'write', validate(z.object({ truckNumber: z.string().min(1) })), async () => ({})),
  });
  const response = await invoke(service, 'Create', { truckNumber: '' });
  assert.deepEqual([response.STATUS, response.ERROR_CODE, response.ERROR_FILTER], ['ERROR', 'FLEET-SYS002', 'INVALID_REQUEST']);
});
