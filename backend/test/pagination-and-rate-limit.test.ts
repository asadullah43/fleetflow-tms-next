import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../classes/app-error.js';
import { rateLimitError } from '../middlewares/rate-limit.js';
import { buildListArgs, filter, ListConfig, paginationMeta } from '../utils/pagination.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import { listRequest } from '../validations/common.validation.js';

const config: ListConfig = {
  searchFields: ['name', 'customer.name'],
  sortFields: { id: 'id', name: 'name', customerName: 'customer.name' },
  defaultSort: { field: 'id', order: 'desc' },
  filters: { status: filter.equals('status'), customerId: filter.id('customerId'), fromDate: filter.dateFrom('tripDate'), toDate: filter.dateTo('tripDate') },
};
const query = (overrides: object = {}) => listRequest.parse({ page: 0, pageSize: 0, ...overrides });

test('list requests default to page 1 with 20 rows, and cap at 100', () => {
  assert.deepEqual({ page: query().page, pageSize: query().pageSize }, { page: 1, pageSize: 20 });
  assert.equal(query({ pageSize: 100 }).pageSize, 100);
  assert.equal(listRequest.safeParse({ page: 1, pageSize: 101 }).success, false);
  assert.equal(listRequest.safeParse({ page: -1, pageSize: 10 }).success, false);
});

test('page and pageSize become skip/take', () => {
  const args = buildListArgs(query({ page: 3, pageSize: 25 }), config);
  assert.equal(args.skip, 50);
  assert.equal(args.take, 25);
});

test('search is a case-insensitive contains across the declared fields, including relations', () => {
  const { where } = buildListArgs(query({ search: '  acme ' }), config);
  assert.deepEqual((where.AND as object[])[1], {
    OR: [{ name: { contains: 'acme', mode: 'insensitive' } }, { customer: { name: { contains: 'acme', mode: 'insensitive' } } }],
  });
});

test('only declared sort fields are accepted; id is added as a stable tiebreaker', () => {
  assert.deepEqual(buildListArgs(query({ sortBy: 'customerName', sortOrder: 'asc' }), config).orderBy, [{ customer: { name: 'asc' } }, { id: 'desc' }]);
  assert.deepEqual(buildListArgs(query(), config).orderBy, [{ id: 'desc' }]);
  assert.throws(() => buildListArgs(query({ sortBy: 'passwordHash' }), config), AppError);
});

test('only declared filters are accepted, and their values are validated', () => {
  const { where } = buildListArgs(query({ filters: { status: 'ACTIVE', customerId: '7', fromDate: '2026-01-01', toDate: '2026-01-31' } }), config);
  assert.deepEqual((where.AND as object[]).slice(1), [
    { status: 'ACTIVE' },
    { customerId: 7 },
    { tripDate: { gte: new Date('2026-01-01T00:00:00.000Z') } },
    { tripDate: { lt: new Date('2026-02-01T00:00:00.000Z') } },
  ]);
  assert.throws(() => buildListArgs(query({ filters: { companyId: '2' } }), config), /Unknown filter/);
  assert.throws(() => buildListArgs(query({ filters: { customerId: 'abc' } }), config), AppError);
  assert.throws(() => buildListArgs(query({ filters: { fromDate: 'yesterday' } }), config), AppError);
});

test('the caller-supplied base condition is always kept', () => {
  const { where } = buildListArgs(query({ search: 'x' }), config, { batchId: 5 });
  assert.deepEqual((where.AND as object[])[0], { batchId: 5 });
});

test('pagination metadata', () => {
  assert.deepEqual(paginationMeta(query({ page: 2, pageSize: 10 }), 21), { page: 2, pageSize: 10, totalItems: 21, totalPages: 3 });
  assert.equal(paginationMeta(query(), 0).totalPages, 0);
});

test('rate limiter: allows the configured points, then blocks for blockSeconds', () => {
  let now = 0;
  const limiter = new RateLimiter({ points: 3, windowSeconds: 60, blockSeconds: 120 }, () => now);
  assert.deepEqual([1, 2, 3].map(() => limiter.consume('k').allowed), [true, true, true]);
  assert.equal(limiter.peek('k').remainingPoints, 0);
  const blocked = limiter.consume('k');
  assert.deepEqual(blocked, { allowed: false, remainingPoints: 0, retryAfterSeconds: 120 });
  now = 119_000;
  assert.equal(limiter.consume('k').retryAfterSeconds, 1);
  now = 120_001;
  assert.equal(limiter.consume('k').allowed, true);
});

test('rate limiter: keys are independent, windows expire, reset clears', () => {
  let now = 0;
  const limiter = new RateLimiter({ points: 1, windowSeconds: 10, blockSeconds: 10 }, () => now);
  limiter.consume('a');
  assert.equal(limiter.consume('b').allowed, true);
  now = 10_000;
  assert.equal(limiter.consume('a').allowed, true);
  limiter.consume('a');
  limiter.reset('a');
  assert.equal(limiter.peek('a').allowed, true);
});

test('the rate-limit error carries RATE-429001 and the RATE_LIMIT block', () => {
  const envelope = rateLimitError('IP', { allowed: false, remainingPoints: 0, retryAfterSeconds: 300 }).toResponse();
  assert.equal(envelope.ERROR_CODE, 'RATE-429001');
  assert.equal(envelope.ERROR_FILTER, 'RATE_LIMIT_EXCEEDED');
  assert.equal(envelope.ERROR_DESCRIPTION, 'Too many requests. Please try again in 5 minutes.');
  assert.deepEqual(envelope.RATE_LIMIT, { type: 'IP', retryAfterSeconds: 300, remainingPoints: 0 });
});
