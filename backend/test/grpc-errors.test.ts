import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as grpc from '@grpc/grpc-js';
import { toAppError } from '../src/lib/grpc-errors.js';
import { AppError } from '../src/common/errors/app-error.js';
import { ErrorCode } from '../src/common/errors/error-codes.js';
import { serialize } from '../src/lib/serialize.js';

const prismaError = (code: string) => Object.assign(new Error(`Prisma ${code}`), { code });
const wrapped500 = (cause: unknown) => AppError.from(ErrorCode.TRK_CREATE_FAILED, 500, cause);

test('unique violation becomes ALREADY_EXISTS with a duplicate message', () => {
  const err = toAppError(wrapped500(prismaError('P2002')));
  assert.equal(err.errorCode, ErrorCode.SYS_DUPLICATE.code);
  assert.equal(err.toGrpcServiceError().code, grpc.status.ALREADY_EXISTS);
});

test('foreign-key violation reads differently for writes and deletes', () => {
  assert.equal(toAppError(wrapped500(prismaError('P2003')), 'write').errorCode, ErrorCode.SYS_INVALID_REFERENCE.code);
  assert.equal(toAppError(wrapped500(prismaError('P2003')), 'delete').errorCode, ErrorCode.SYS_RECORD_IN_USE.code);
});

test('record-not-found from Prisma becomes NOT_FOUND', () => {
  assert.equal(toAppError(prismaError('P2025')).toGrpcServiceError().code, grpc.status.NOT_FOUND);
});

test('deliberate 4xx AppErrors pass through untouched', () => {
  const denied = AppError.from(ErrorCode.AUTH_PERMISSION_DENIED, 403);
  assert.equal(toAppError(denied), denied);
  assert.equal(denied.toGrpcServiceError().code, grpc.status.PERMISSION_DENIED);
});

test('unknown errors become a generic INTERNAL error without leaking details', () => {
  const err = toAppError(new Error('connection string postgres://user:secret@db leaked'));
  assert.equal(err.errorCode, ErrorCode.SYS_UNEXPECTED.code);
  const wire = err.toGrpcServiceError();
  assert.equal(wire.code, grpc.status.INTERNAL);
  assert.ok(!wire.details.includes('secret'));
});

test('AppError attaches the structured envelope as app-error-bin metadata', () => {
  const wire = AppError.from(ErrorCode.TRK_NOT_FOUND, 404).toGrpcServiceError();
  const envelope = JSON.parse(String(wire.metadata.get('app-error-bin')[0]));
  assert.equal(envelope.ERROR_CODE, 'FLEET-TRK001');
});

test('serialize turns Decimal-like values and Dates into strings, recursively', () => {
  const decimal = { toNumber: () => 1.5, toFixed: () => '1.50', toString: () => '1.5' };
  assert.deepEqual(serialize({ a: decimal, b: [new Date('2026-01-01T00:00:00Z')], c: null }), {
    a: '1.5',
    b: ['2026-01-01T00:00:00.000Z'],
    c: null,
  });
});
