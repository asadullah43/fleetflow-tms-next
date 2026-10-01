import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../classes/app-error.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { toAppError } from '../middlewares/error-handler.js';
import { ErrorFilter } from '../models/api-response.js';
import { serialize } from '../utils/serialize.js';

const prismaError = (code: string) => Object.assign(new Error(`Prisma ${code}`), { code });
const wrapped500 = (cause: unknown) => AppError.from(ErrorCode.TRK_CREATE_FAILED, 500, cause);

test('unique violation becomes a duplicate (INVALID_REQUEST) error', () => {
  const err = toAppError(wrapped500(prismaError('P2002')));
  assert.equal(err.errorCode, ErrorCode.SYS_DUPLICATE.code);
  assert.equal(err.errorFilter, ErrorFilter.INVALID_REQUEST);
  assert.equal(err.statusCode, 409);
});

test('foreign-key violation reads differently for writes and deletes', () => {
  assert.equal(toAppError(wrapped500(prismaError('P2003')), 'write').errorCode, ErrorCode.SYS_INVALID_REFERENCE.code);
  assert.equal(toAppError(wrapped500(prismaError('P2003')), 'delete').errorCode, ErrorCode.SYS_RECORD_IN_USE.code);
});

test('record-not-found from Prisma becomes a 404', () => {
  assert.equal(toAppError(prismaError('P2025')).statusCode, 404);
});

test('deliberate 4xx AppErrors pass through untouched', () => {
  const denied = AppError.from(ErrorCode.AUTH_PERMISSION_DENIED, 403);
  assert.equal(toAppError(denied), denied);
  assert.equal(denied.toResponse().ERROR_FILTER, ErrorFilter.USER_NOT_AUTHORIZED);
});

test('unknown errors become the generic technical error without leaking details', () => {
  const err = toAppError(new Error('connection string postgres://user:secret@db leaked at /app/services/x.ts'));
  const envelope = err.toResponse();
  assert.equal(envelope.ERROR_CODE, ErrorCode.SYS_UNEXPECTED.code);
  assert.equal(envelope.ERROR_FILTER, ErrorFilter.TECHNICAL_ISSUE);
  assert.ok(!JSON.stringify(envelope).includes('secret'));
  assert.ok(!JSON.stringify(envelope).includes('/app/'));
});

test('the error envelope has exactly the standard fields', () => {
  const envelope = AppError.from(ErrorCode.TRK_NOT_FOUND, 404).toResponse();
  assert.deepEqual(Object.keys(envelope).sort(), ['ERROR_CODE', 'ERROR_DESCRIPTION', 'ERROR_FILTER', 'STATUS']);
  assert.equal(envelope.STATUS, 'ERROR');
  assert.equal(envelope.ERROR_CODE, 'FLEET-TRK001');
});

test('a description override replaces the text but keeps the registered code and filter', () => {
  const err = AppError.from(ErrorCode.SYS_VALIDATION_ERROR, 400, undefined, 'Invalid value for "name".');
  assert.equal(err.toResponse().ERROR_DESCRIPTION, 'Invalid value for "name".');
  assert.equal(err.errorCode, ErrorCode.SYS_VALIDATION_ERROR.code);
});

test('serialize turns Decimal-like values and Dates into strings, recursively', () => {
  const decimal = { toNumber: () => 1.5, toFixed: () => '1.50', toString: () => '1.5' };
  assert.deepEqual(serialize({ a: decimal, b: [new Date('2026-01-01T00:00:00Z')], c: null }), {
    a: '1.5',
    b: ['2026-01-01T00:00:00.000Z'],
    c: null,
  });
});
