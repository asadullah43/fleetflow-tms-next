/**
 * The Redis read cache (_core_app_connectivities/cache.ts), against an
 * in-memory store with Redis semantics. The cache's own hooks are driven
 * exactly as prisma.ts drives them: `beforeRead(model, args)` before each
 * read query, `invalidateAfterWrite(model, args, result)` after each write.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DATABASE_URL ??= 'postgresql://unused@127.0.0.1:1/unused';
const { beforeRead, cacheCodec, cachedRead, cacheKeys, cacheStats, invalidateAfterWrite, resetCacheStateForTests, trackRequestWrites, warmUpCache } = await import('../_core_app_connectivities/cache.js');
const { MemoryStore, RedisStore, setCacheStore } = await import('../_core_app_connectivities/redis.js');
const { MODEL_RELATIONS, modelsTouched } = await import('../_core_app_connectivities/model-relations.js');
const { runUnscoped, runWithTenant } = await import('../_core_app_connectivities/tenant-context.js');
const { Prisma } = await import('../generated/prisma/client.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TTL = 300;

async function freshCache() {
  const store = new MemoryStore();
  setCacheStore(store);
  resetCacheStateForTests();
  assert.equal(await warmUpCache(), true);
  return store;
}

/** A cached "list" that reads `models` (as the Prisma hook would report) and counts how often it really ran. */
function fakeList(rowsFor: () => unknown, models: [string, unknown?][] = [['Truck']]) {
  const counter = { runs: 0 };
  const read = (scope = 'Truck.list', args: unknown = { query: { page: 1 } }) =>
    cachedRead(scope, args, TTL, async () => {
      counter.runs++;
      for (const [model, queryArgs] of models) await beforeRead(model, queryArgs ?? {});
      return rowsFor();
    });
  return { read, counter };
}

// ── Tenant isolation (the top review criterion) ──────────────────────────
test('every data and version key embeds the company id; keys cannot be built without a valid company', () => {
  assert.match(cacheKeys.data(42, 'Truck.list', 'abc'), /^fleetflow:company:42:data:Truck\.list:abc$/);
  assert.match(cacheKeys.version(42, 'Truck'), /^fleetflow:company:42:version:Truck$/);
  assert.notEqual(cacheKeys.data(1, 'Truck.list', 'abc'), cacheKeys.data(2, 'Truck.list', 'abc'));
  for (const bad of [0, -1, Number.NaN, 1.5, undefined as unknown as number, null as unknown as number]) {
    assert.throws(() => cacheKeys.data(bad, 'Truck.list', 'abc'), /invalid company/);
    assert.throws(() => cacheKeys.version(bad, 'Truck'), /invalid company/);
  }
});

test("two companies' identical queries never share an entry, and each company only ever sees its own rows", async () => {
  const store = await freshCache();
  let company = 0;
  const { read, counter } = fakeList(() => ({ items: [{ id: company, name: `truck of company ${company}` }] }));

  company = 1;
  const first = await runWithTenant(1, () => read());
  company = 2;
  const second = await runWithTenant(2, () => read());
  assert.equal(counter.runs, 2, "company 2's identical query is computed, not served company 1's entry");
  assert.deepEqual(first, { items: [{ id: 1, name: 'truck of company 1' }] });
  assert.deepEqual(second, { items: [{ id: 2, name: 'truck of company 2' }] });

  // Both are now cached — and still each to its own company.
  company = 99; // a recomputation would be visible as "company 99"
  assert.deepEqual(await runWithTenant(1, () => read()), first);
  assert.deepEqual(await runWithTenant(2, () => read()), second);
  assert.equal(counter.runs, 2);

  // Nothing in the store is keyed without a company, except the data-free epoch token.
  for (const key of store.data.keys()) {
    if (key === cacheKeys.epoch()) continue;
    assert.match(key, /^fleetflow:company:[1-9]\d*:(data|version):/, key);
  }
});

test("a write in one company invalidates only that company's entries", async () => {
  await freshCache();
  const { read, counter } = fakeList(() => ({ items: [] }));
  await runWithTenant(1, () => read());
  await runWithTenant(2, () => read());
  await runWithTenant(2, () => invalidateAfterWrite('Truck', { data: { truckNumber: 'X' } }, { id: 5, companyId: 2 }));
  await runWithTenant(1, () => read());
  assert.equal(counter.runs, 2, 'company 1 still served from cache');
  await runWithTenant(2, () => read());
  assert.equal(counter.runs, 3, 'company 2 recomputed');
});

test('nothing is cached without a tenant context, or in an unscoped (cross-company) context', async () => {
  const store = await freshCache();
  const { read, counter } = fakeList(() => ({ items: [] }));
  await read();
  await read();
  await runUnscoped(() => read());
  assert.equal(counter.runs, 3);
  assert.deepEqual([...store.data.keys()], [cacheKeys.epoch()]);
});

test('a cached read that touches another company (unscoped query inside it) is not stored', async () => {
  await freshCache();
  const counter = { runs: 0 };
  const read = () =>
    cachedRead('User.list', {}, TTL, async () => {
      counter.runs++;
      await beforeRead('User', {});
      await runUnscoped(() => beforeRead('User', {}));
      return [];
    });
  await runWithTenant(1, read);
  await runWithTenant(1, read);
  assert.equal(counter.runs, 2);
});

// ── Invalidation on create / update / delete ─────────────────────────────
for (const [operation, args, result] of [
  ['create', { data: { truckNumber: 'T-9', status: 'ACTIVE' } }, { id: 9, companyId: 1 }],
  ['update', { where: { id: 9 }, data: { status: 'MAINTENANCE' } }, { id: 9, companyId: 1 }],
  ['delete', { where: { id: 9 } }, { id: 9, companyId: 1 }],
  ['deleteMany', { where: { status: 'INACTIVE' } }, { count: 3 }],
] as const) {
  test(`${operation} invalidates the model's cached lists immediately — the next read recomputes`, async () => {
    await freshCache();
    let version = 'before';
    const { read, counter } = fakeList(() => ({ items: [{ version }] }));
    await runWithTenant(1, () => read());
    assert.deepEqual(await runWithTenant(1, () => read()), { items: [{ version: 'before' }] });
    assert.equal(counter.runs, 1);

    version = 'after';
    await runWithTenant(1, () => invalidateAfterWrite('Truck', args, result));
    assert.deepEqual(await runWithTenant(1, () => read()), { items: [{ version: 'after' }] }, 'no stale page after a save');
    assert.equal(counter.runs, 2);
  });
}

test('writing a related table invalidates pages that show it (a renamed customer on the trips list)', async () => {
  await freshCache();
  const { read, counter } = fakeList(() => ({ items: [] }), [['Trip', { include: { customer: { select: { name: true } }, truck: true } }]]);
  await runWithTenant(1, () => read('Trip.list'));
  await runWithTenant(1, () => invalidateAfterWrite('Location', { data: { name: 'unrelated' } }, { id: 1, companyId: 1 }));
  await runWithTenant(1, () => read('Trip.list'));
  assert.equal(counter.runs, 1, 'a write to a table the page does not read leaves it cached');
  await runWithTenant(1, () => invalidateAfterWrite('Customer', { where: { id: 3 }, data: { name: 'Renamed' } }, { id: 3, companyId: 1 }));
  await runWithTenant(1, () => read('Trip.list'));
  assert.equal(counter.runs, 2);
});

test('nested writes invalidate every table they reach (role permissions updated through the role)', async () => {
  await freshCache();
  const { read, counter } = fakeList(() => [], [['Permission']]);
  await runWithTenant(1, () => read('Permission.list'));
  await runWithTenant(1, () => invalidateAfterWrite('Role', { where: { id: 1 }, data: { permissions: { deleteMany: {}, createMany: { data: [] } } } }, { id: 1, companyId: 1 }));
  await runWithTenant(1, () => read('Permission.list'));
  assert.equal(counter.runs, 2);
});

test('the dashboard is invalidated by a write to any table it counts', async () => {
  await freshCache();
  const tables: [string][] = [['Truck'], ['Driver'], ['Trip'], ['WorkOrder'], ['Invoice'], ['LeaveRequest'], ['SparePart']];
  const { read, counter } = fakeList(() => ({ activeTrucks: 1 }), tables);
  const dashboard = () => read('dashboard.operations', { day: '2026-10-03T00:00:00.000Z' });
  await runWithTenant(1, dashboard);
  for (const [table] of tables) {
    const before = counter.runs;
    await runWithTenant(1, () => invalidateAfterWrite(table, { data: {} }, { id: 1, companyId: 1 }));
    await runWithTenant(1, dashboard);
    assert.equal(counter.runs, before + 1, `a ${table} write refreshes the dashboard`);
  }
});

test('a write that lands while a read is being computed is never hidden by that read being cached', async () => {
  await freshCache();
  let runs = 0;
  const read = () =>
    cachedRead('Truck.list', {}, TTL, async () => {
      runs++;
      await beforeRead('Truck', {}); // version taken before the query
      if (runs === 1) await invalidateAfterWrite('Truck', { data: {} }, { id: 1, companyId: 1 }); // concurrent save, after our query
      return { runs };
    });
  await runWithTenant(1, read);
  assert.deepEqual(await runWithTenant(1, read), { runs: 2 }, 'the first result was not served');
});

test('writes are invalidated again when the request finishes (after a transaction commits)', async () => {
  await freshCache();
  const { read, counter } = fakeList(() => ({ items: [] }));
  await runWithTenant(1, () =>
    trackRequestWrites(async () => {
      await invalidateAfterWrite('Truck', { data: {} }, { id: 1, companyId: 1 }); // inside the transaction, before commit
      await read(); // a concurrent reader caches pre-commit rows under the new version…
    }),
  );
  await runWithTenant(1, () => read());
  assert.equal(counter.runs, 2, '…which the post-request invalidation throws away');
});

test('a write without a tenant context invalidates the company of the rows it returned, or everything if it cannot tell', async () => {
  await freshCache();
  const { read, counter } = fakeList(() => []);
  await runWithTenant(1, () => read());
  await runWithTenant(2, () => read());
  await runUnscoped(() => invalidateAfterWrite('Truck', { where: { id: 1 }, data: {} }, { id: 1, companyId: 2 }));
  await runWithTenant(1, () => read());
  await runWithTenant(2, () => read());
  assert.equal(counter.runs, 3, 'only company 2 recomputed');
  await runUnscoped(() => invalidateAfterWrite('Truck', { where: {} }, { count: 4 }));
  await runWithTenant(1, () => read());
  await runWithTenant(2, () => read());
  assert.equal(counter.runs, 5, 'both recomputed');
});

// ── Never cached: sequences and ZATCA ─────────────────────────────────────
test('a cached computation that writes anything (a sequence number, a ZATCA submission) is never stored', async () => {
  await freshCache();
  let runs = 0;
  const sequenceRead = () =>
    cachedRead('misuse', {}, TTL, async () => {
      runs++;
      await beforeRead('Invoice', { orderBy: { id: 'desc' }, select: { invoiceNumber: true } });
      await invalidateAfterWrite('Invoice', { data: { invoiceNumber: `INV-${runs}` } }, { id: runs, companyId: 1 });
      return `INV-${runs}`;
    });
  assert.equal(await runWithTenant(1, sequenceRead), 'INV-1');
  assert.equal(await runWithTenant(1, sequenceRead), 'INV-2', 'the next number comes from the database');
});

test('number sequences, ZATCA submission and single-record reads are not wrapped in the cache', () => {
  const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
  assert.doesNotMatch(read('utils/sequence.ts'), /cache/i, 'utils/sequence.ts');
  // In every service, cachedRead appears only inside list / summary reads.
  for (const file of fs.readdirSync(path.join(ROOT, 'services'))) {
    const source = read(`services/${file}`);
    for (const match of source.matchAll(/cachedRead\('([^']+)'/g)) assert.match(match[1], /^(\w+\.(list|batches)|dashboard\.\w+)$/, `${file}: ${match[1]}`);
    for (const method of ['create', 'update', 'remove', 'markPaid', 'submitToZatca', 'findOne', 'findByBatch', 'getBatchDocument', 'revoke']) {
      const body = new RegExp(`\\n  async ${method}\\([^)]*\\)[^{]*\\{([\\s\\S]*?)\\n  \\},`).exec(source)?.[1] ?? '';
      assert.doesNotMatch(body, /cachedRead/, `${file}: ${method} must always read the database`);
    }
  }
  const repository = read('data_repositories/crud.repository.ts');
  assert.match(repository, /cachedRead\(cacheScope/, 'the shared repository list goes through the cache');
  assert.doesNotMatch(/async function findOne[\s\S]*?\n  \}/.exec(repository)?.[0] ?? '', /cachedRead/, 'findOne (used by update/remove) is never cached');
});

test('two repositories cannot share a list cache scope', async () => {
  const { registerListScope } = await import('../data_repositories/crud.repository.js');
  registerListScope('TestOnly.list');
  assert.throws(() => registerListScope('TestOnly.list'), /registered twice/);
});

test('every cached read in the app has its own scope (repository lists and service reads never collide)', () => {
  const scopes: string[] = [];
  for (const file of fs.readdirSync(path.join(ROOT, 'services'))) {
    const source = fs.readFileSync(path.join(ROOT, 'services', file), 'utf8');
    for (const match of source.matchAll(/createCrudRepository\(\{\s*model: '(\w+)'/g)) scopes.push(`${match[1][0].toUpperCase()}${match[1].slice(1)}.list`);
    for (const match of source.matchAll(/cachedRead\('([^']+)'/g)) scopes.push(match[1]);
  }
  assert.ok(scopes.length >= 30, `found ${scopes.length}`);
  assert.deepEqual(scopes.filter((scope, index) => scopes.indexOf(scope) !== index), []);
});

// ── Redis unavailable: fall through to the database ───────────────────────
test('with Redis down every read falls through to the database and nothing fails', async () => {
  const store = await freshCache();
  const { read, counter } = fakeList(() => ({ items: ['from db'] }));
  store.down = true;
  assert.deepEqual(await runWithTenant(1, () => read()), { items: ['from db'] });
  assert.deepEqual(await runWithTenant(1, () => read()), { items: ['from db'] });
  assert.equal(counter.runs, 2);
  await runWithTenant(1, () => invalidateAfterWrite('Truck', { data: {} }, { id: 1, companyId: 1 })); // must not throw
});

test('an invalidation lost during an outage can never surface a stale page after Redis comes back', async () => {
  const store = await freshCache();
  let version = 'old';
  const { read, counter } = fakeList(() => ({ version }));
  await runWithTenant(1, () => read()); // cached as "old"

  store.down = true;
  version = 'new';
  await runWithTenant(1, () => invalidateAfterWrite('Truck', { data: {} }, { id: 1, companyId: 1 })); // undeliverable
  store.down = false; // Redis reachable again, still holding the "old" entry
  assert.deepEqual(await runWithTenant(1, () => read()), { version: 'new' }, 'paused: read from the database');

  store.recover(); // reconnection replaces the epoch
  assert.equal(await warmUpCache(), true);
  assert.deepEqual(await runWithTenant(1, () => read()), { version: 'new' });
  assert.deepEqual(await runWithTenant(1, () => read()), { version: 'new' });
  assert.equal(counter.runs, 3, 'cached again once recovered — with the new data');
});

test('an unreachable Redis server fails fast instead of holding requests', async () => {
  const store = new RedisStore('redis://127.0.0.1:1', 150);
  setCacheStore(store);
  resetCacheStateForTests();
  const started = Date.now();
  assert.equal(await warmUpCache(300), false);
  const { read, counter } = fakeList(() => ['from db']);
  assert.deepEqual(await runWithTenant(1, () => read()), ['from db']);
  await runWithTenant(1, () => invalidateAfterWrite('Truck', { data: {} }, { id: 1, companyId: 1 }));
  assert.equal(counter.runs, 1);
  assert.ok(Date.now() - started < 2000, `took ${Date.now() - started}ms`);
  await store.quit();
  setCacheStore(null);
});

test('with caching switched off (no REDIS_URL) reads go straight to the database', async () => {
  setCacheStore(null);
  resetCacheStateForTests();
  const { read, counter } = fakeList(() => 1);
  await runWithTenant(1, () => read());
  await runWithTenant(1, () => read());
  assert.equal(counter.runs, 2);
  assert.equal(cacheStats.hits, 0);
});

// ── Responses come back exactly as the database produced them ─────────────
test('cached values keep their types: Date, Decimal, undefined, nested rows', () => {
  const row = {
    id: 7,
    total: new Prisma.Decimal('1234.50'),
    issuedAt: new Date('2026-10-03T08:15:00.000Z'),
    paidAt: null,
    note: undefined,
    customer: { name: 'شركة', nameAr: 'شركة' },
    lineItems: [{ amount: new Prisma.Decimal('0.10'), quantity: 3 }],
  };
  const back = cacheCodec.decode(JSON.parse(JSON.stringify(cacheCodec.encode(row)))) as typeof row;
  assert.ok(back.total instanceof Prisma.Decimal);
  assert.equal(back.total.toString(), '1234.5');
  assert.equal(back.total.toFixed(2), '1234.50');
  assert.ok(back.issuedAt instanceof Date);
  assert.equal(back.issuedAt.toISOString(), row.issuedAt.toISOString());
  assert.ok('note' in back && back.note === undefined);
  assert.deepEqual(back, row);
  assert.throws(() => cacheCodec.encode({ file: Buffer.from('x') }), /unsupported/);
  assert.equal(cacheCodec.hash({ a: 1, b: [2] }), cacheCodec.hash({ b: [2], a: 1 }), 'argument order does not matter');
});

test('a result the codec cannot represent is returned but not cached', async () => {
  await freshCache();
  const { read, counter } = fakeList(() => ({ blob: Buffer.from('x') }));
  await runWithTenant(1, () => read());
  await runWithTenant(1, () => read());
  assert.equal(counter.runs, 2);
});

// ── Relations the invalidation relies on ──────────────────────────────────
test('MODEL_RELATIONS matches every relation in prisma/schema.prisma', () => {
  const schema = fs.readFileSync(path.join(ROOT, 'prisma/schema.prisma'), 'utf8').replace(/\r\n/g, '\n');
  const models = new Map([...schema.matchAll(/^model (\w+) \{\n([\s\S]*?)^\}/gm)].map((m) => [m[1], m[2]]));
  const expected: Record<string, Record<string, string>> = {};
  for (const [name, body] of models) {
    const relations: Record<string, string> = {};
    for (const field of body.matchAll(/^\s+(\w+)\s+(\w+)(\[\])?\??(\s|$)/gm)) if (models.has(field[2])) relations[field[1]] = field[2];
    if (Object.keys(relations).length > 0) expected[name] = relations;
  }
  assert.deepEqual(MODEL_RELATIONS, expected);
});

test('modelsTouched follows include, select, _count, relation filters, sorts and nested writes', () => {
  const touched = (model: string, args: unknown) => [...modelsTouched(model, args)].sort();
  assert.deepEqual(touched('Trip', { include: { customer: true, truck: { select: { truckNumber: true } } } }), ['Customer', 'Trip', 'Truck']);
  assert.deepEqual(touched('Role', { include: { permissions: true, _count: { select: { users: true } } } }), ['Permission', 'Role', 'User']);
  assert.deepEqual(touched('Trip', { where: { AND: [{ OR: [{ customer: { name: { contains: 'a' } } }] }] }, orderBy: [{ driver: { name: 'asc' } }] }), ['Customer', 'Driver', 'Trip']);
  assert.deepEqual(touched('Invoice', { data: { lineItems: { create: [{ description: 'x' }] } } }), ['Invoice', 'InvoiceLineItem']);
  assert.deepEqual(touched('Truck', { where: { createdAt: { gte: new Date() } } }), ['Truck']);
});
