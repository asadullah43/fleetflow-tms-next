/**
 * Backend-authoritative duplicate protection for create-type operations.
 *
 * When the client sends metadata `idempotency-key: <unique value>`, the
 * same (company, operation, key) always resolves to one logical
 * operation: a retry — double click, network retry, integration replay —
 * returns the first attempt's result instead of creating a second
 * record. The unique index on IdempotencyRecord makes this safe under
 * concurrency. Without the header the request runs normally (database
 * uniqueness constraints still apply).
 */
import crypto from 'node:crypto';
import { prisma } from '../_core_app_connectivities/prisma.js';
import { currentCompanyId } from '../_core_app_connectivities/tenant-context.js';
import { AppError } from '../classes/app-error.js';
import { config } from '../global_config/index.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { logger } from '../utils/logger.js';
import { serialize } from '../utils/serialize.js';
import { header, Middleware } from './request-context.js';

const HEADER = 'idempotency-key';
const MAX_KEY_LENGTH = 200;

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'P2002';
}

export const idempotency: Middleware = async (ctx, next) => {
  const key = header(ctx.metadata, HEADER)?.trim();
  if (!key) return next();
  if (key.length > MAX_KEY_LENGTH) throw AppError.from(ErrorCode.SYS_VALIDATION_ERROR, 400, undefined, 'Idempotency-Key is too long.');

  const companyId = currentCompanyId();
  const operation = ctx.rpc;
  const requestHash = crypto.createHash('sha256').update(JSON.stringify(ctx.input ?? null)).digest('hex');
  const where = { companyId_operation_key: { companyId, operation, key } };
  const expiresAt = new Date(Date.now() + config.idempotency.ttlHours * 60 * 60 * 1000);

  for (let attempt = 0; ; attempt++) {
    try {
      await prisma.idempotencyRecord.create({ data: { companyId, operation, key, requestHash, expiresAt } });
      break; // we own this key: run the operation
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const existing = await prisma.idempotencyRecord.findUnique({ where });
      if (!existing || existing.expiresAt < new Date()) {
        // Vanished (the first attempt failed and released it) or expired: claim it again, once.
        if (existing) await prisma.idempotencyRecord.deleteMany({ where: { id: existing.id } });
        if (attempt === 0) continue;
        throw AppError.from(ErrorCode.SYS_IDEMPOTENCY_IN_PROGRESS, 409);
      }
      if (existing.requestHash !== requestHash) throw AppError.from(ErrorCode.SYS_IDEMPOTENCY_KEY_REUSED, 400);
      if (existing.status === 'COMPLETED') return existing.response; // replay the stored result
      throw AppError.from(ErrorCode.SYS_IDEMPOTENCY_IN_PROGRESS, 409);
    }
  }

  let result: unknown;
  try {
    result = serialize(await next());
  } catch (error) {
    // The operation did not happen: release the key so the caller can retry.
    await prisma.idempotencyRecord.deleteMany({ where: { companyId, operation, key } }).catch(() => undefined);
    throw error;
  }

  // The operation DID happen. If its result cannot be stored, the key must still not be released — a retry would
  // then run it a second time. Left IN_PROGRESS, a retry is refused (409) until the record expires: never a duplicate.
  try {
    await prisma.idempotencyRecord.update({ where, data: { status: 'COMPLETED', response: (result ?? {}) as object } });
  } catch (error) {
    logger.error('idempotency: operation succeeded but its result could not be stored; retries with this key are refused until it expires', { operation, error });
  }
  return result;
};
