/**
 * The QA / hardening fixes against a live backend and database:
 * D-01 (VAT range), D-02 (date order, including a partial update),
 * D-03 (invoice → trip reference: an invoice without a trip is unchanged,
 * linking / unlinking touches nothing but the link), administrator
 * escalation through Users / Roles, and concurrent truck assignments.
 */
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, ADMIN_USER, SKIP, call, client, loginAs, must } from './client.js';

describe('QA hardening (live backend)', { skip: SKIP }, () => {
  const stamp = Date.now();
  let admin = '';
  let customerId = 0;
  let truckId = 0;
  let pickupId = 0;
  let deliveryId = 0;
  let cargoTypeId = 0;
  const invoices = () => client('invoices', 'InvoicesService');
  const trips = () => client('trips', 'TripsService');
  const hr = (service: string) => client('hr', service);
  const users = () => client('users', 'UsersService');
  const roles = () => client('roles', 'RolesService');

  const invoiceRequest = (extra: object = {}) => ({
    customerId,
    dueDate: '2026-11-15',
    fromDate: '2026-10-01',
    toDate: '2026-10-31',
    vatEnabled: true,
    lineItems: [{ description: 'Haul', quantity: '2', rate: '150' }],
    ...extra,
  });
  let tripSeq = 0;
  const newTrip = async () =>
    must(
      await call(
        trips(),
        'create',
        { transactionNumber: `QA-${stamp}-${++tripSeq}`, customerId, pickupLocationId: pickupId, deliveryLocationId: deliveryId, cargoTypeId, quantity: '12.5', tripDate: '2026-10-05', truckId },
        admin,
      ),
    );
  const getTrip = async (id: number) => must(await call(trips(), 'get', { id }, admin));
  const getInvoice = async (id: number) => must(await call(invoices(), 'get', { id }, admin));
  /** A record without the link fields, to compare everything else. */
  const without = (row: Record<string, unknown>, ...keys: string[]) => Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)));
  const TRIP_LINK = ['invoiceId', 'invoiceNumber'];
  const INVOICE_LINK = ['tripId', 'tripTransactionNumber'];

  before(async () => {
    admin = await loginAs(ADMIN_USER, ADMIN_PASSWORD);
    customerId = must(await call(client('customers', 'CustomersService'), 'create', { name: `QA Customer ${stamp}` }, admin)).id;
    truckId = must(await call(client('trucks', 'TrucksService'), 'create', { truckNumber: `QA-${stamp}` }, admin)).id;
    pickupId = must(await call(client('locations', 'LocationsService'), 'create', { name: `QA From ${stamp}` }, admin)).id;
    deliveryId = must(await call(client('locations', 'LocationsService'), 'create', { name: `QA To ${stamp}` }, admin)).id;
    cargoTypeId = must(await call(client('cargotypes', 'CargoTypesService'), 'create', { name: `QA Cargo ${stamp}` }, admin)).id;
  });

  // ── D-01 ──
  test('D-01: a VAT rate above 100% is refused; 0 to 100 is accepted', async () => {
    assert.equal((await call(invoices(), 'create', invoiceRequest({ vatPercent: '250' }), admin)).err?.errorFilter, 'INVALID_REQUEST');
    const inv = must(await call(invoices(), 'create', invoiceRequest({ vatPercent: '100' }), admin));
    assert.equal(Number(inv.vatPercent), 100);
    assert.equal((await call(invoices(), 'update', { id: inv.id, vatPercent: '250' }, admin)).err?.errorFilter, 'INVALID_REQUEST');
    assert.equal(Number((await getInvoice(inv.id)).vatPercent), 100, 'unchanged');
  });

  // ── D-02 ──
  test('D-02: a leave or contract ending before it starts is refused — on create and on a partial update', async () => {
    const department = must(await call(hr('DepartmentsService'), 'create', { name: `QA ${stamp}` }, admin));
    const employeeId = must(await call(hr('EmployeesService'), 'create', { name: `QA Person ${stamp}`, departmentId: department.id, joiningDate: '2026-01-01' }, admin)).id;
    const leaves = hr('LeaveRequestsService');

    const reversed = await call(leaves, 'create', { employeeId, leaveType: 'ANNUAL', startDate: '2026-03-10', endDate: '2026-03-05', days: 1 }, admin);
    assert.equal(reversed.err?.errorFilter, 'INVALID_REQUEST');
    const leave = must(await call(leaves, 'create', { employeeId, leaveType: 'ANNUAL', startDate: '2026-03-10', endDate: '2026-03-12', days: 3 }, admin));
    assert.equal((await call(leaves, 'update', { id: leave.id, endDate: '2026-03-01' }, admin)).err?.errorCode, 'FLEET-HR011', 'only the end sent: checked against the stored start');
    assert.equal((await call(leaves, 'update', { id: leave.id, startDate: '2026-03-20' }, admin)).err?.errorCode, 'FLEET-HR011', 'only the start sent');
    must(await call(leaves, 'update', { id: leave.id, endDate: '2026-03-10' }, admin));

    const contracts = hr('EmploymentContractsService');
    assert.equal((await call(contracts, 'create', { employeeId, contractNumber: `QA-C-${stamp}`, startDate: '2026-02-01', endDate: '2026-01-01' }, admin)).err?.errorFilter, 'INVALID_REQUEST');

    const inv = must(await call(invoices(), 'create', invoiceRequest(), admin));
    assert.equal((await call(invoices(), 'create', invoiceRequest({ fromDate: '2026-10-31', toDate: '2026-10-01' }), admin)).err?.errorFilter, 'INVALID_REQUEST');
    assert.equal((await call(invoices(), 'update', { id: inv.id, toDate: '2026-09-01' }, admin)).err?.errorCode, 'FLEET-INV011');
  });

  // ── D-03 ──
  test('D-03: an invoice with no trip works exactly as before', async () => {
    const inv = must(await call(invoices(), 'create', invoiceRequest(), admin));
    assert.equal(inv.tripId, undefined, 'no trip: the optional field is absent');
    assert.equal(inv.tripTransactionNumber, undefined);
    assert.equal(Number(inv.subtotal), 300);
    assert.equal(Number(inv.total), 345);
    const edited = must(await call(invoices(), 'update', { id: inv.id, dueDate: '2026-12-01' }, admin));
    assert.equal(edited.tripId, undefined, 'an edit that does not mention the trip leaves it alone');
    assert.deepEqual(without(edited, 'dueDate'), without(inv, 'dueDate'));
    must(await call(invoices(), 'markPaid', { id: inv.id }, admin));
    must(await call(invoices(), 'delete', { id: inv.id }, admin));
  });

  test('D-03: linking and unlinking a trip changes only the link on either record', async () => {
    const trip = await newTrip();
    const inv = must(await call(invoices(), 'create', invoiceRequest(), admin));

    const linked = must(await call(invoices(), 'update', { id: inv.id, tripId: trip.id }, admin));
    assert.equal(linked.tripId, trip.id);
    assert.equal(linked.tripTransactionNumber, trip.transactionNumber);
    const tripLinked = await getTrip(trip.id);
    assert.equal(tripLinked.invoiceId, inv.id);
    assert.equal(tripLinked.invoiceNumber, inv.invoiceNumber);
    assert.deepEqual(without(linked, ...INVOICE_LINK), without(inv, ...INVOICE_LINK), 'nothing else on the invoice changed');
    assert.deepEqual(without(tripLinked, ...TRIP_LINK), without(trip, ...TRIP_LINK), 'nothing else on the trip changed');

    // The trip keeps its own workflow: editing it does not touch the invoice, nor drop the link.
    must(await call(trips(), 'update', { id: trip.id, quantity: '20' }, admin));
    assert.equal((await getTrip(trip.id)).invoiceId, inv.id);
    assert.deepEqual(await getInvoice(inv.id), linked);
    must(await call(trips(), 'update', { id: trip.id, quantity: '12.5' }, admin));

    const unlinked = must(await call(invoices(), 'update', { id: inv.id, tripId: 0 }, admin));
    assert.equal(unlinked.tripId, undefined);
    assert.deepEqual(without(unlinked, ...INVOICE_LINK), without(inv, ...INVOICE_LINK));
    const tripAfter = await getTrip(trip.id);
    assert.equal(tripAfter.invoiceId, undefined);
    assert.deepEqual(without(tripAfter, ...TRIP_LINK), without(trip, ...TRIP_LINK));
  });

  test('D-03: link on create; a trip on another invoice or an unknown trip is refused; replacing and deleting release it', async () => {
    const trip = await newTrip();
    const other = await newTrip();
    const first = must(await call(invoices(), 'create', invoiceRequest({ tripId: trip.id }), admin));
    assert.equal(first.tripId, trip.id);

    const taken = await call(invoices(), 'create', invoiceRequest({ tripId: trip.id }), admin);
    assert.equal(taken.err?.errorCode, 'FLEET-INV012');
    const second = must(await call(invoices(), 'create', invoiceRequest(), admin));
    assert.equal((await call(invoices(), 'update', { id: second.id, tripId: trip.id }, admin)).err?.errorCode, 'FLEET-INV012');
    assert.equal((await getInvoice(second.id)).tripId, undefined, 'the refused link left the invoice as it was');
    assert.equal((await call(invoices(), 'create', invoiceRequest({ tripId: 999999999 }), admin)).err?.errorCode, 'FLEET-TRP001');

    // Replacing: the old trip is let go, the new one linked.
    must(await call(invoices(), 'update', { id: first.id, tripId: other.id }, admin));
    assert.equal((await getTrip(trip.id)).invoiceId, undefined);
    assert.equal((await getTrip(other.id)).invoiceId, first.id);

    // Deleting the invoice releases the trip; the trip itself stays.
    must(await call(invoices(), 'delete', { id: first.id }, admin));
    const released = await getTrip(other.id);
    assert.equal(released.invoiceId, undefined);
    assert.equal(released.transactionNumber, other.transactionNumber);
  });

  // ── Administrator escalation ──
  test('a user manager who is not an administrator cannot create, promote, edit or remove administrators', async () => {
    const managerRole = must(await call(roles(), 'create', { name: `USERS_ONLY_${stamp}`, permissions: [{ module: 'users', canView: true, canAdd: true, canEdit: true, canDelete: true }] }, admin));
    must(
      await call(
        users(),
        'create',
        { name: 'Manager', email: `mgr${stamp}@test.local`, username: `mgr${stamp}`, password: 'MgrPass123!', roleId: managerRole.id, status: 'ACTIVE', language: 'en' },
        admin,
      ),
    );
    const manager = await loginAs(`mgr${stamp}`, 'MgrPass123!');

    const adminRole = must(await call(roles(), 'list', { search: 'ADMIN', pageSize: 100 }, admin)).items.find((role: any) => role.name === 'ADMIN');
    const adminUser = must(await call(users(), 'list', { search: ADMIN_USER, pageSize: 100 }, admin)).items.find((user: any) => user.username === ADMIN_USER);
    assert.ok(adminRole && adminUser);

    const person = (extra: object) => ({ name: 'X', email: `x${stamp}${Math.random()}@test.local`, password: 'Pass12345!', status: 'ACTIVE', language: 'en', ...extra });
    assert.equal((await call(users(), 'create', person({ roleId: adminRole.id }), manager)).err?.errorCode, 'FLEET-USR011', 'ADMIN role');
    assert.equal((await call(users(), 'create', person({ role: 'ADMIN' }), manager)).err?.errorCode, 'FLEET-USR011', 'legacy ADMIN text, no role');
    assert.equal((await call(users(), 'create', person({ role: ' admin ' }), manager)).err?.errorCode, 'FLEET-USR011', 'legacy text, any case');

    const plain = must(await call(users(), 'create', person({ roleId: managerRole.id }), manager));
    assert.equal((await call(users(), 'update', { id: plain.id, roleId: adminRole.id }, manager)).err?.errorCode, 'FLEET-USR011', 'promote someone');
    assert.equal((await call(users(), 'update', { id: adminUser.id, password: 'Takeover123!' }, manager)).err?.errorCode, 'FLEET-USR011', "reset an administrator's password");
    assert.equal((await call(users(), 'delete', { id: adminUser.id }, manager)).err?.errorCode, 'FLEET-USR011', 'remove an administrator');
    // Ordinary user management still works.
    must(await call(users(), 'update', { id: plain.id, name: 'Renamed' }, manager));
    must(await call(users(), 'delete', { id: plain.id }, manager));
    // An administrator still can.
    const promoted = must(await call(users(), 'create', person({ roleId: managerRole.id }), admin));
    must(await call(users(), 'update', { id: promoted.id, roleId: adminRole.id }, admin));
    must(await call(users(), 'delete', { id: promoted.id }, admin));
  });

  test('no second role may be named ADMIN (any case), by create or rename', async () => {
    assert.equal((await call(roles(), 'create', { name: 'admin', permissions: [] }, admin)).err?.errorCode, 'FLEET-ROL011');
    const role = must(await call(roles(), 'create', { name: `PLAIN_${stamp}`, permissions: [] }, admin));
    assert.equal((await call(roles(), 'update', { id: role.id, name: ' Admin ' }, admin)).err?.errorCode, 'FLEET-ROL011');
  });

  // ── Concurrency ──
  test('two simultaneous overlapping assignments for one truck: exactly one is created', async () => {
    const drivers = client('drivers', 'DriversService');
    const truck = must(await call(client('trucks', 'TrucksService'), 'create', { truckNumber: `QA-RACE-${stamp}` }, admin)).id;
    const driverIds = [];
    for (let i = 0; i < 4; i++) driverIds.push(must(await call(drivers, 'create', { name: `QA Driver ${stamp}-${i}` }, admin)).id);
    const assignments = client('assignments', 'AssignmentsService');
    const results = await Promise.all(driverIds.map((driverId) => call(assignments, 'create', { truckId: truck, driverId, startDate: '2026-10-01' }, admin)));
    assert.equal(results.filter((r) => r.ok).length, 1, JSON.stringify(results.map((r) => r.err?.errorCode ?? 'OK')));
    assert.ok(results.filter((r) => r.err).every((r) => r.err!.errorCode === 'FLEET-TRK008'));
  });
});
