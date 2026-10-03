/**
 * The pure parts of the QA / hardening fixes: range and date-order
 * validation (D-01, D-02), the reserved administrator role name, and the
 * idempotency guard's behaviour when storing a result fails. The
 * database-backed parts (invoice ↔ trip link, user escalation,
 * concurrent assignments) are in test/integration/qa-hardening.itest.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as grpc from '@grpc/grpc-js';

process.env.DATABASE_URL ??= 'postgresql://unused@127.0.0.1:1/unused';
process.env.JWT_SECRET ??= 'unit-test-secret';
const { ErrorCode } = await import('../global_config/error-codes.js');
const { AppError } = await import('../classes/app-error.js');
const { createInvoiceRequest, updateInvoiceRequest } = await import('../validations/invoices.validation.js');
const { createLeaveRequestRequest, updateLeaveRequestRequest, createEmploymentContractRequest } = await import('../validations/hr.validation.js');
const { assertPeriodOrder } = await import('../services/hr.service.js');
const { rolesService } = await import('../services/roles.service.js');
const { idempotency } = await import('../middlewares/idempotency.js');
const { prisma } = await import('../_core_app_connectivities/prisma.js');
const { runWithTenant } = await import('../_core_app_connectivities/tenant-context.js');
import type { RequestContext } from '../middlewares/request-context.js';

const invoice = (extra: Record<string, unknown> = {}) => ({
  customerId: 1,
  dueDate: '2026-02-01',
  fromDate: '2026-01-01',
  toDate: '2026-01-31',
  lineItems: [{ description: 'Haul', quantity: '1', rate: '100' }],
  ...extra,
});
const issuesAt = (result: { success: boolean; error?: { issues: { path: (string | number)[] }[] } }) => (result.success ? [] : result.error!.issues.map((issue) => issue.path.join('.')));
const codeOf = async (run: Promise<unknown>) =>
  run.then(
    () => 'OK',
    (error) => (error as InstanceType<typeof AppError>).errorCode,
  );

test('D-01: VAT and line tax percentages are 0 to 100', () => {
  assert.deepEqual(issuesAt(createInvoiceRequest.safeParse(invoice({ vatPercent: '250' }))), ['vatPercent']);
  assert.deepEqual(issuesAt(createInvoiceRequest.safeParse(invoice({ vatPercent: '100.01' }))), ['vatPercent']);
  assert.deepEqual(issuesAt(createInvoiceRequest.safeParse(invoice({ vatPercent: '-1' }))), ['vatPercent']);
  for (const ok of ['0', '15', '12.5', '100', '']) assert.equal(createInvoiceRequest.safeParse(invoice({ vatPercent: ok })).success, true, ok);
  assert.equal(createInvoiceRequest.safeParse(invoice()).success, true, 'not given at all');

  assert.deepEqual(issuesAt(createInvoiceRequest.safeParse(invoice({ lineItems: [{ description: 'x', quantity: '1', rate: '1', taxPercent: '101' }] }))), ['lineItems.0.taxPercent']);
  assert.deepEqual(issuesAt(updateInvoiceRequest.safeParse({ id: 1, vatPercent: '250' })), ['vatPercent']);
  assert.equal(updateInvoiceRequest.safeParse({ id: 1, vatPercent: '15' }).success, true);
});

test('D-02: an end date before the start date is refused; the same day is fine', () => {
  const leave = { employeeId: 1, leaveType: 'ANNUAL', startDate: '2026-03-10', endDate: '2026-03-05', days: 1 };
  assert.deepEqual(issuesAt(createLeaveRequestRequest.safeParse(leave)), ['endDate']);
  assert.equal(createLeaveRequestRequest.safeParse({ ...leave, endDate: '2026-03-10' }).success, true);
  assert.deepEqual(issuesAt(updateLeaveRequestRequest.safeParse({ id: 1, startDate: '2026-03-10', endDate: '2026-03-01' })), ['endDate']);
  // One end alone passes the schema; the service checks it against the stored other end.
  assert.equal(updateLeaveRequestRequest.safeParse({ id: 1, endDate: '2026-03-01' }).success, true);

  assert.deepEqual(issuesAt(createEmploymentContractRequest.safeParse({ employeeId: 1, contractNumber: 'C-1', contractType: 'FULL_TIME', startDate: '2026-01-01', endDate: '2025-12-31' })), [
    'endDate',
  ]);
  assert.deepEqual(issuesAt(createInvoiceRequest.safeParse(invoice({ fromDate: '2026-02-01', toDate: '2026-01-01' }))), ['toDate']);
});

test('D-02: an update that moves one end is checked against the stored other end', () => {
  const stored = { startDate: new Date('2026-03-10'), endDate: new Date('2026-03-12') };
  const hrCode = (fn: () => unknown) => {
    try {
      fn();
      return 'OK';
    } catch (error) {
      return (error as InstanceType<typeof AppError>).errorCode;
    }
  };
  assert.equal(
    hrCode(() => assertPeriodOrder({ endDate: new Date('2026-03-01') }, stored)),
    ErrorCode.HR_DATE_ORDER.code,
  );
  assert.equal(
    hrCode(() => assertPeriodOrder({ startDate: new Date('2026-03-20') }, stored)),
    ErrorCode.HR_DATE_ORDER.code,
  );
  assert.equal(
    hrCode(() => assertPeriodOrder({ endDate: new Date('2026-03-10') }, stored)),
    'OK',
  );
  assert.equal(
    hrCode(() => assertPeriodOrder({ endDate: null }, stored)),
    'OK',
    'clearing an open-ended contract end',
  );
  assert.equal(
    hrCode(() => assertPeriodOrder({ status: 'APPROVED' } as never, stored)),
    'OK',
    'no date in the update',
  );
});

test('D-03: tripId on invoice create / update — update takes 0 to unlink', () => {
  assert.equal(createInvoiceRequest.safeParse(invoice({ tripId: 7 })).success, true);
  assert.equal(updateInvoiceRequest.safeParse({ id: 1, tripId: 0 }).success, true);
  assert.equal(updateInvoiceRequest.safeParse({ id: 1, tripId: 7 }).success, true);
  assert.equal(updateInvoiceRequest.safeParse({ id: 1, tripId: -1 }).success, false);
});

test('no second role may carry the administrator name, whatever its case or spaces', async () => {
  for (const name of ['ADMIN', 'admin', ' Admin ']) {
    assert.equal(await codeOf(rolesService.create({ name, permissions: [] } as never)), ErrorCode.ROL_RESERVED_NAME.code, name);
  }
});

// ── Idempotency: an operation that ran is never run twice, even when its result can't be stored ──

type Row = { id: number; companyId: number; operation: string; key: string; requestHash: string; status: string; response?: unknown; expiresAt: Date };

function fakeIdempotencyStore(options: { failUpdate?: boolean } = {}) {
  const rows: Row[] = [];
  const match = (where: any) => {
    const w = where.companyId_operation_key ?? where;
    return rows.find((row) => (w.id === undefined || row.id === w.id) && (w.key === undefined || (row.companyId === w.companyId && row.operation === w.operation && row.key === w.key)));
  };
  const store = {
    rows,
    async create({ data }: { data: Omit<Row, 'id' | 'status'> }) {
      if (rows.some((row) => row.companyId === data.companyId && row.operation === data.operation && row.key === data.key)) throw Object.assign(new Error('unique'), { code: 'P2002' });
      rows.push({ id: rows.length + 1, status: 'IN_PROGRESS', ...data });
    },
    async findUnique({ where }: { where: unknown }) {
      return match(where) ?? null;
    },
    async update({ where, data }: { where: unknown; data: Partial<Row> }) {
      if (options.failUpdate) throw new Error('database went away');
      Object.assign(match(where)!, data);
    },
    async deleteMany({ where }: { where: unknown }) {
      const row = match(where);
      if (row) rows.splice(rows.indexOf(row), 1);
      return { count: row ? 1 : 0 };
    },
  };
  return store;
}

async function withStore<T>(store: ReturnType<typeof fakeIdempotencyStore>, fn: () => Promise<T>): Promise<T> {
  const original = prisma.idempotencyRecord;
  Object.defineProperty(prisma, 'idempotencyRecord', { value: store, configurable: true, writable: true });
  try {
    return await runWithTenant(1, fn);
  } finally {
    Object.defineProperty(prisma, 'idempotencyRecord', { value: original, configurable: true, writable: true });
  }
}

const idemCtx = (key: string, input: unknown = { name: 'x' }): RequestContext => {
  const metadata = new grpc.Metadata();
  metadata.set('idempotency-key', key);
  return { rpc: 'test/Create', requestId: 'r', startedAt: Date.now(), ip: '10.0.0.1', metadata, request: input, input, principal: null } as RequestContext;
};

test('idempotency: a retry replays the stored result instead of running the operation again', async () => {
  const store = fakeIdempotencyStore();
  let runs = 0;
  const op = async () => ({ id: ++runs });
  const first = await withStore(store, () => idempotency(idemCtx('k1'), op));
  const retry = await withStore(store, () => idempotency(idemCtx('k1'), op));
  assert.deepEqual(first, { id: 1 });
  assert.deepEqual(retry, { id: 1 });
  assert.equal(runs, 1);
});

test('idempotency: a failed operation releases its key, so the retry runs', async () => {
  const store = fakeIdempotencyStore();
  let runs = 0;
  const failing = async () => {
    runs++;
    throw new Error('boom');
  };
  await assert.rejects(withStore(store, () => idempotency(idemCtx('k2'), failing)));
  assert.equal(store.rows.length, 0);
  assert.deepEqual(await withStore(store, () => idempotency(idemCtx('k2'), async () => ({ id: ++runs }))), { id: 2 });
});

test('idempotency: when the result cannot be stored the key is kept, so a retry is refused rather than run twice', async () => {
  const store = fakeIdempotencyStore({ failUpdate: true });
  let runs = 0;
  const op = async () => ({ id: ++runs });
  assert.deepEqual(await withStore(store, () => idempotency(idemCtx('k3'), op)), { id: 1 }, 'the caller still gets the result');
  assert.equal(store.rows.length, 1, 'the key was not released');
  assert.equal(await codeOf(withStore(store, () => idempotency(idemCtx('k3'), op))), ErrorCode.SYS_IDEMPOTENCY_IN_PROGRESS.code);
  assert.equal(runs, 1, 'never run a second time');
});
