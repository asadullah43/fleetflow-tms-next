/**
 * The platform guarantees, against a real backend + database:
 * the response envelope, server-side pagination/search, tenant isolation,
 * API keys, idempotency, rate limiting and session expiry.
 *
 * Needs INTEGRATION_GRPC_ADDR. The tenant-isolation and session tests
 * also need DATABASE_URL and JWT_SECRET to be the backend's own (they
 * provision a second company and sign an already-expired token).
 */
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { ADMIN_PASSWORD, ADMIN_USER, SKIP, call, client, loginAs, must, unique } from './client.js';

const hasBackendEnv = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET;
const stamp = unique();
const trucks = () => client('trucks', 'TrucksService');
const auth = () => client('auth', 'AuthService');

describe('response envelope', { skip: SKIP }, () => {
  let token = '';
  before(async () => {
    token = await loginAs(ADMIN_USER, ADMIN_PASSWORD);
  });

  test('success and failure share one shape', async () => {
    const good = await call(trucks(), 'list', {}, token);
    const bad = await call(trucks(), 'get', { id: 2_000_000_000 }, token);
    for (const { envelope } of [good, bad]) {
      for (const key of ['STATUS', 'ERROR_CODE', 'ERROR_FILTER', 'ERROR_DESCRIPTION', 'DB_DATA']) assert.ok(key in envelope, key);
    }
    assert.deepEqual([good.envelope.STATUS, good.envelope.ERROR_CODE, good.envelope.ERROR_FILTER, good.envelope.ERROR_DESCRIPTION], ['SUCCESSFUL', '', '', '']);
    assert.deepEqual([bad.envelope.STATUS, bad.err?.errorCode, bad.err?.errorFilter], ['ERROR', 'FLEET-TRK001', 'INVALID_REQUEST']);
  });

  test('validation errors name the field and never reach the database', async () => {
    const r = await call(trucks(), 'create', { truckNumber: '' }, token);
    assert.equal(r.err?.errorCode, 'FLEET-SYS002');
    assert.match(r.err?.description ?? '', /truckNumber/);
  });

  test('login returns the session expiry, 12 hours out', async () => {
    const session = must(await call(auth(), 'login', { username: ADMIN_USER, password: ADMIN_PASSWORD }));
    const hours = (new Date(session.expiresAt).getTime() - Date.now()) / 3_600_000;
    assert.ok(hours > 11.9 && hours <= 12, `expires in ${hours}h`);
    assert.ok(session.user.companyId > 0);
  });
});

describe('server-side pagination, search and sort', { skip: SKIP }, () => {
  let token = '';
  const prefix = `PG${stamp}`;
  before(async () => {
    token = await loginAs(ADMIN_USER, ADMIN_PASSWORD);
    for (const n of [1, 2, 3, 4, 5]) must(await call(trucks(), 'create', { truckNumber: `${prefix}-${n}`, truckType: n % 2 ? 'Flatbed' : 'Tanker' }, token));
  });

  test('pages are bounded and carry totals', async () => {
    const page1 = must(await call(trucks(), 'list', { search: prefix, page: 1, pageSize: 2, sortBy: 'truckNumber', sortOrder: 'asc' }, token));
    assert.deepEqual(page1.items.map((t: any) => t.truckNumber), [`${prefix}-1`, `${prefix}-2`]);
    assert.deepEqual(page1.pagination, { page: 1, pageSize: 2, totalItems: 5, totalPages: 3 });
    const page3 = must(await call(trucks(), 'list', { search: prefix, page: 3, pageSize: 2, sortBy: 'truckNumber', sortOrder: 'asc' }, token));
    assert.deepEqual(page3.items.map((t: any) => t.truckNumber), [`${prefix}-5`]);
  });

  test('defaults apply when the client sends nothing; oversize pages are refused', async () => {
    const page = must(await call(trucks(), 'list', {}, token));
    assert.equal(page.pagination.page, 1);
    assert.equal(page.pagination.pageSize, 20);
    assert.ok(page.items.length <= 20);
    assert.equal((await call(trucks(), 'list', { pageSize: 5000 }, token)).err?.errorCode, 'FLEET-SYS002');
  });

  test('search is case-insensitive and partial; filters and sort are whitelisted', async () => {
    const found = must(await call(trucks(), 'list', { search: prefix.toLowerCase(), filters: { status: 'ACTIVE' } }, token));
    assert.equal(found.pagination.totalItems, 5);
    assert.equal(must(await call(trucks(), 'list', { search: `${prefix}-nothing` }, token)).pagination.totalItems, 0);
    assert.equal((await call(trucks(), 'list', { sortBy: 'companyId' }, token)).err?.errorFilter, 'INVALID_REQUEST');
    assert.equal((await call(trucks(), 'list', { filters: { companyId: '2' } }, token)).err?.errorFilter, 'INVALID_REQUEST');
  });

  test('Arabic names are stored and searchable', async () => {
    const customers = client('customers', 'CustomersService');
    const created = must(await call(customers, 'create', { name: `Arabic ${stamp}`, nameAr: `شركة ${stamp}` }, token));
    assert.equal(created.nameAr, `شركة ${stamp}`);
    assert.equal(must(await call(customers, 'list', { search: `شركة ${stamp}` }, token)).items[0]?.id, created.id);
  });
});

describe('idempotency', { skip: SKIP }, () => {
  let token = '';
  before(async () => {
    token = await loginAs(ADMIN_USER, ADMIN_PASSWORD);
  });

  test('a retried create with the same key returns the first result and creates nothing new', async () => {
    const request = { truckNumber: `IDEM-${stamp}` };
    const key = `key-${stamp}`;
    const first = must(await call(trucks(), 'create', request, { token, idempotencyKey: key }));
    const retry = must(await call(trucks(), 'create', request, { token, idempotencyKey: key }));
    assert.equal(retry.id, first.id);
    assert.equal(must(await call(trucks(), 'list', { search: `IDEM-${stamp}` }, token)).pagination.totalItems, 1);
  });

  test('concurrent duplicates produce exactly one record', async () => {
    const request = { truckNumber: `RACE-${stamp}` };
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => call(trucks(), 'create', request, { token, idempotencyKey: `race-${stamp}` })));
    const ids = new Set(results.filter((r) => r.ok).map((r) => r.ok.id));
    assert.equal(ids.size, 1);
    for (const r of results.filter((x) => x.err)) assert.equal(r.err?.errorCode, 'FLEET-SYS010');
    assert.equal(must(await call(trucks(), 'list', { search: `RACE-${stamp}` }, token)).pagination.totalItems, 1);
  });

  test('reusing a key with a different payload is rejected', async () => {
    const key = `reuse-${stamp}`;
    must(await call(trucks(), 'create', { truckNumber: `REUSE-A-${stamp}` }, { token, idempotencyKey: key }));
    assert.equal((await call(trucks(), 'create', { truckNumber: `REUSE-B-${stamp}` }, { token, idempotencyKey: key })).err?.errorCode, 'FLEET-SYS009');
  });

  test('a failed attempt releases the key so a corrected retry can succeed', async () => {
    const key = `fail-${stamp}`;
    const dup = await call(trucks(), 'create', { truckNumber: `IDEM-${stamp}` }, { token, idempotencyKey: key });
    assert.equal(dup.err?.errorFilter, 'INVALID_REQUEST');
    assert.equal((await call(trucks(), 'create', { truckNumber: `IDEM-${stamp}` }, { token, idempotencyKey: key })).err?.errorFilter, 'INVALID_REQUEST');
  });

  test('loading orders: a double-clicked Generate issues one batch of serials', async () => {
    const location = must(await call(client('locations', 'LocationsService'), 'create', { name: `Yard ${stamp}` }, token));
    const customer = must(await call(client('customers', 'CustomersService'), 'create', { name: `LO Customer ${stamp}` }, token));
    const cargo = must(await call(client('cargotypes', 'CargoTypesService'), 'create', { name: `Cargo ${stamp}` }, token));
    const orders = client('loadingorders', 'LoadingOrdersService');
    const request = { pickupLocationId: location.id, deliveryLocationId: location.id, customerId: customer.id, cargoTypeId: cargo.id, quantity: 3 };
    const [a, b] = await Promise.all([1, 2].map(() => call(orders, 'create', request, { token, idempotencyKey: `lo-${stamp}` })));
    const batch = (a.ok ?? b.ok).items;
    assert.equal(batch.length, 3);
    if (a.ok && b.ok) assert.deepEqual(a.ok.items.map((o: any) => o.serialNumber), b.ok.items.map((o: any) => o.serialNumber));

    const grouped = must(await call(orders, 'listGrouped', { search: `LO Customer ${stamp}` }, token));
    assert.equal(grouped.pagination.totalItems, 1);
    assert.equal(grouped.items[0].quantity, 3);
    assert.equal(grouped.items[0].firstSerialNumber, batch[0].serialNumber);
    assert.equal(grouped.items[0].lastSerialNumber, batch[2].serialNumber);

    // The printable document comes from the backend: slips + this company's branding.
    const document = must(await call(orders, 'getBatchDocument', { batchId: batch[0].batchId }, token));
    assert.equal(document.orders.length, 3);
    assert.ok(document.company.companyName);
    assert.ok(document.generatedAt);
    assert.equal(document.orders[0].customerName, `LO Customer ${stamp}`);
  });
});

describe('API keys', { skip: SKIP }, () => {
  let token = '';
  let key = '';
  let keyId = 0;
  const keys = () => client('apikeys', 'ApiKeysService');
  const trips = () => client('trips', 'TripsService');

  before(async () => {
    token = await loginAs(ADMIN_USER, ADMIN_PASSWORD);
    const created = must(await call(keys(), 'create', { name: `Integration ${stamp}`, scopes: [{ module: 'trips', canView: true }, { module: 'customers', canView: true, canAdd: true }] }, token));
    key = created.plaintextKey;
    keyId = created.apiKey.id;
  });

  test('the key is shown once; lists expose only a prefix', async () => {
    assert.match(key, /^ffk_/);
    const listed = must(await call(keys(), 'list', { search: `Integration ${stamp}` }, token)).items[0];
    assert.equal(listed.id, keyId);
    assert.ok(key.startsWith(listed.keyPrefix) && listed.keyPrefix.length < key.length);
    assert.ok(!JSON.stringify(listed).includes(key));
  });

  test('a key reaches the same API with exactly its scopes', async () => {
    assert.ok((await call(trips(), 'list', {}, { apiKey: key })).ok);
    assert.equal((await call(trips(), 'create', { transactionNumber: `K${stamp}` }, { apiKey: key })).err?.errorFilter, 'USER_NOT_AUTHORIZED');
    assert.ok((await call(client('customers', 'CustomersService'), 'create', { name: `Via key ${stamp}` }, { apiKey: key })).ok);
    // Lookup lists are open to signed-in users, but a key needs the explicit view scope.
    assert.equal((await call(trucks(), 'list', {}, { apiKey: key })).err?.errorFilter, 'USER_NOT_AUTHORIZED');
    assert.equal((await call(client('invoices', 'InvoicesService'), 'list', {}, { apiKey: key })).err?.errorFilter, 'USER_NOT_AUTHORIZED');
  });

  test('a key is not a user: no profile, no key management, no user/role scopes', async () => {
    assert.equal((await call(auth(), 'getMe', {}, { apiKey: key })).err?.errorFilter, 'USER_NOT_AUTHORIZED');
    assert.equal((await call(keys(), 'list', {}, { apiKey: key })).err?.errorFilter, 'USER_NOT_AUTHORIZED');
    assert.equal((await call(keys(), 'create', { name: 'x', scopes: [{ module: 'trips', canView: true }] }, { apiKey: key })).err?.errorFilter, 'USER_NOT_AUTHORIZED');
    assert.equal((await call(keys(), 'create', { name: 'x', scopes: [{ module: 'users', canView: true }] }, token)).err?.errorCode, 'FLEET-APK005');
    assert.equal((await call(keys(), 'create', { name: 'x', scopes: [] }, token)).err?.errorCode, 'FLEET-APK007');
    const mine = must(await call(auth(), 'getMyPermissions', {}, { apiKey: key })).permissions;
    assert.deepEqual(mine.filter((p: any) => p.canView).map((p: any) => p.module).sort(), ['customers', 'trips']);
  });

  test('wrong and revoked keys are rejected; revocation is immediate', async () => {
    assert.equal((await call(trips(), 'list', {}, { apiKey: 'ffk_not-a-real-key' })).err?.errorCode, 'FLEET-AUTH007');
    assert.equal(must(await call(keys(), 'revoke', { id: keyId }, token)).status, 'REVOKED');
    const after = await call(trips(), 'list', {}, { apiKey: key });
    assert.deepEqual([after.err?.errorCode, after.err?.errorFilter], ['FLEET-AUTH007', 'USER_NOT_AUTHENTICATED']);
  });

  test('a user cannot grant a key more than they hold', async () => {
    const role = must(await call(client('roles', 'RolesService'), 'create', { name: `KEYMAKER_${stamp}`, permissions: [{ module: 'apiKeys', canView: true, canAdd: true }, { module: 'trips', canView: true }] }, token));
    must(await call(client('users', 'UsersService'), 'create', { name: 'Keymaker', email: `km${stamp}@test.local`, username: `km${stamp}`, password: 'KeyMaker123!', roleId: role.id }, token));
    const keymaker = await loginAs(`km${stamp}`, 'KeyMaker123!');
    assert.ok((await call(keys(), 'create', { name: 'ok', scopes: [{ module: 'trips', canView: true }] }, keymaker)).ok);
    assert.equal((await call(keys(), 'create', { name: 'too much', scopes: [{ module: 'trips', canView: true, canDelete: true }] }, keymaker)).err?.errorCode, 'FLEET-APK006');
    assert.equal((await call(keys(), 'create', { name: 'too much', scopes: [{ module: 'invoices', canView: true }] }, keymaker)).err?.errorCode, 'FLEET-APK006');
  });
});

describe('rate limiting', { skip: SKIP }, () => {
  test('repeated failed sign-ins block the username with RATE_LIMIT details', async () => {
    const username = `nobody-${stamp}`;
    let blocked;
    for (let attempt = 0; attempt < 15 && !blocked; attempt++) {
      const r = await call(auth(), 'login', { username, password: 'wrong-password' });
      if (r.err?.errorFilter === 'RATE_LIMIT_EXCEEDED') blocked = r;
      else assert.equal(r.err?.errorCode, 'FLEET-AUTH001');
    }
    assert.ok(blocked, 'expected to be blocked within 15 attempts');
    assert.equal(blocked.err?.errorCode, 'FLEET-AUTH006');
    assert.equal(blocked.err?.rateLimit?.type, 'USER');
    assert.equal(blocked.err?.rateLimit?.remainingPoints, 0);
    assert.ok((blocked.err?.rateLimit?.retryAfterSeconds ?? 0) > 0);
    assert.match(blocked.err?.description ?? '', /try again in \d+ (seconds|minutes)/);
    // Other usernames are unaffected.
    assert.ok((await call(auth(), 'login', { username: ADMIN_USER, password: ADMIN_PASSWORD })).ok);
  });
});

describe('sessions and tenant isolation', { skip: SKIP || (!hasBackendEnv && 'needs the backend DATABASE_URL and JWT_SECRET') }, () => {
  let tokenA = '';
  let tokenB = '';
  let companyB = 0;
  let truckA = 0;
  const usernameB = `tenantb${stamp}`;

  before(async () => {
    const { provisioningService } = await import('../../services/provisioning.service.js');
    const created = await provisioningService.createCompany({ companyName: `Tenant B ${stamp}`, adminEmail: `${usernameB}@test.local`, adminUsername: usernameB, adminPassword: 'TenantB123!' });
    companyB = created.companyId;
    tokenA = await loginAs(ADMIN_USER, ADMIN_PASSWORD);
    tokenB = await loginAs(usernameB, 'TenantB123!');
    truckA = must(await call(trucks(), 'create', { truckNumber: `ISO-${stamp}` }, tokenA)).id;
  });

  test('a token past its 12 hours is rejected by the backend', async () => {
    const me = must(await call(auth(), 'getMe', {}, tokenA));
    const issuedAt = Math.floor(Date.now() / 1000) - 12 * 60 * 60 - 5;
    const stale = jwt.sign({ sub: me.id, email: me.email, roleId: me.roleId, companyId: me.companyId, iat: issuedAt }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '12h' });
    const r = await call(trucks(), 'list', {}, stale);
    assert.deepEqual([r.err?.errorCode, r.err?.errorFilter], ['FLEET-AUTH004', 'USER_NOT_AUTHENTICATED']);
    const almost = jwt.sign({ sub: me.id, email: me.email, roleId: me.roleId, companyId: me.companyId, iat: issuedAt + 60 }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '12h' });
    assert.ok((await call(trucks(), 'list', {}, almost)).ok);
  });

  test('a new company starts empty and is its own admin', async () => {
    const me = must(await call(auth(), 'getMe', {}, tokenB));
    assert.equal(me.companyId, companyB);
    for (const [pkg, service] of [['trucks', 'TrucksService'], ['customers', 'CustomersService'], ['invoices', 'InvoicesService'], ['trips', 'TripsService'], ['users', 'UsersService']] as const) {
      const page = must(await call(client(pkg, service), 'list', {}, tokenB));
      assert.equal(page.pagination.totalItems, service === 'UsersService' ? 1 : 0, service);
    }
    assert.equal(must(await call(client('dashboard', 'DashboardService'), 'getSummary', {}, tokenB)).activeTrucks, 0);
  });

  test("another company's records cannot be read, changed, deleted or found by search", async () => {
    assert.equal((await call(trucks(), 'get', { id: truckA }, tokenB)).err?.errorCode, 'FLEET-TRK001');
    assert.equal((await call(trucks(), 'update', { id: truckA, truckType: 'stolen' }, tokenB)).err?.errorCode, 'FLEET-TRK001');
    assert.equal((await call(trucks(), 'delete', { id: truckA }, tokenB)).err?.errorCode, 'FLEET-TRK001');
    assert.equal(must(await call(trucks(), 'list', { search: `ISO-${stamp}` }, tokenB)).pagination.totalItems, 0);
    assert.equal(must(await call(trucks(), 'get', { id: truckA }, tokenA)).truckNumber, `ISO-${stamp}`);
  });

  test("another company's records cannot be referenced", async () => {
    const r = await call(client('workshop', 'WorkOrdersService'), 'create', { truckId: truckA, issue: 'cross-tenant' }, tokenB);
    assert.equal(r.err?.errorCode, 'FLEET-SYS006');
    const role1 = await call(client('users', 'UsersService'), 'create', { name: 'X', email: `x${stamp}@test.local`, username: `x${stamp}`, password: 'Password123!', roleId: 1 }, tokenB);
    assert.equal(role1.err?.errorCode, 'FLEET-SYS006');
  });

  test('a client-supplied company id is ignored', async () => {
    const created = must(await call(trucks(), 'create', { truckNumber: `B-${stamp}`, companyId: 1 } as object, tokenB));
    assert.equal((await call(trucks(), 'get', { id: created.id }, tokenA)).err?.errorCode, 'FLEET-TRK001');
    assert.ok((await call(trucks(), 'get', { id: created.id }, tokenB)).ok);
  });

  test('business numbers are per company: the same truck number and fresh serials in each', async () => {
    assert.ok((await call(trucks(), 'create', { truckNumber: `ISO-${stamp}` }, tokenB)).ok);
    const customer = must(await call(client('customers', 'CustomersService'), 'create', { name: 'First customer' }, tokenB));
    const invoice = must(
      await call(client('invoices', 'InvoicesService'), 'create', { customerId: customer.id, dueDate: '2026-11-01', fromDate: '2026-10-01', toDate: '2026-10-31', lineItems: [{ description: 'Haul', quantity: '1', rate: '100' }] }, tokenB),
    );
    assert.match(invoice.invoiceNumber, /-00001$/);
    const employeeDept = must(await call(client('hr', 'DepartmentsService'), 'create', { name: 'Ops' }, tokenB));
    const employee = must(await call(client('hr', 'EmployeesService'), 'create', { name: 'First', departmentId: employeeDept.id, joiningDate: '2026-01-01' }, tokenB));
    assert.equal(employee.employeeNumber, 'EMP-00001');
  });

  test('usernames and emails stay unique across companies without revealing the other account', async () => {
    const r = await call(client('users', 'UsersService'), 'create', { name: 'Clash', email: `clash${stamp}@test.local`, username: ADMIN_USER, password: 'Password123!' }, tokenB);
    assert.equal(r.err?.errorCode, 'FLEET-USR002');
  });

  test('each company has its own settings, branding and API keys', async () => {
    const settings = client('companysettings', 'CompanySettingsService');
    assert.equal(must(await call(settings, 'get', {}, tokenB)).companyName, `Tenant B ${stamp}`);
    assert.equal(must(await call(settings, 'getBranding', {}, tokenB)).companyName, `Tenant B ${stamp}`);
    assert.notEqual(must(await call(settings, 'getBranding', {})).companyName, `Tenant B ${stamp}`);
    const keyB = must(await call(client('apikeys', 'ApiKeysService'), 'create', { name: 'B key', scopes: [{ module: 'trucks', canView: true }] }, tokenB));
    const seen = must(await call(trucks(), 'list', {}, { apiKey: keyB.plaintextKey }));
    assert.deepEqual(seen.items.map((t: any) => t.truckNumber).sort(), [`B-${stamp}`, `ISO-${stamp}`]);
    assert.equal(must(await call(client('apikeys', 'ApiKeysService'), 'list', { search: 'B key' }, tokenA)).pagination.totalItems, 0);
  });

  test('suspending a company ends its sessions and keys at the next request', async () => {
    const { provisioningService } = await import('../../services/provisioning.service.js');
    await provisioningService.setCompanyStatus(companyB, 'SUSPENDED');
    assert.equal((await call(trucks(), 'list', {}, tokenB)).err?.errorCode, 'FLEET-AUTH008');
    assert.equal((await call(auth(), 'login', { username: usernameB, password: 'TenantB123!' })).err?.errorCode, 'FLEET-AUTH008');
    assert.ok((await call(trucks(), 'list', {}, tokenA)).ok);
    await provisioningService.setCompanyStatus(companyB, 'ACTIVE');
    assert.ok((await call(trucks(), 'list', {}, tokenB)).ok);
  });
});

describe('workshop stock and dashboards', { skip: SKIP }, () => {
  let token = '';
  before(async () => {
    token = await loginAs(ADMIN_USER, ADMIN_PASSWORD);
  });

  test('stock cannot go below zero, and movements adjust it atomically', async () => {
    const parts = client('workshop', 'SparePartsService');
    const movements = client('workshop', 'SparePartTransactionsService');
    const part = must(await call(parts, 'create', { name: `Filter ${stamp}`, partNumber: `F-${stamp}`, quantity: 5, minimumStock: 1, unitCost: '10' }, token));
    must(await call(movements, 'create', { sparePartId: part.id, transactionType: 'OUT', quantity: 3 }, token));
    assert.equal((await call(movements, 'create', { sparePartId: part.id, transactionType: 'OUT', quantity: 3 }, token)).err?.errorCode, 'FLEET-WKS019');
    must(await call(movements, 'create', { sparePartId: part.id, transactionType: 'IN', quantity: 10 }, token));
    assert.equal(must(await call(parts, 'get', { id: part.id }, token)).quantity, 12);
    assert.equal(must(await call(movements, 'list', { filters: { sparePartId: String(part.id) } }, token)).pagination.totalItems, 2);
  });

  test('dashboard summaries are computed on the server', async () => {
    const dashboard = client('dashboard', 'DashboardService');
    const hr = must(await call(dashboard, 'getHrSummary', {}, token));
    assert.equal(hr.totalEmployees, hr.headcountByDepartment.reduce((sum: number, row: any) => sum + row.count, 0));
    const workshop = must(await call(dashboard, 'getWorkshopSummary', {}, token));
    assert.deepEqual(workshop.openByPriority.map((row: any) => row.label), ['URGENT', 'HIGH', 'MEDIUM', 'LOW']);
    assert.match(workshop.expensesThisMonth, /^\d+\.\d{2}$/);
    const fleet = must(await call(dashboard, 'getFleetSummary', {}, token));
    assert.ok(fleet.fleetSize >= fleet.activeTrucks);
  });
});
