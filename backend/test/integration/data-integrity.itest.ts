/**
 * Business-critical write paths against a real backend + database:
 * running numbers survive deletions, invoice totals are cent-exact and
 * internally consistent, ZATCA-signed invoices are locked, database
 * constraint errors come back as clear client errors.
 */
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, ADMIN_USER, SKIP, call, client, loginAs, must } from './client.js';

const cents = (value: string) => Math.round(Number(value) * 100);

describe('data integrity', { skip: SKIP }, () => {
  const stamp = Date.now();
  let token = '';
  let customerId = 0;
  let truckId = 0;
  const invoices = () => client('invoices', 'InvoicesService');
  const newInvoice = (lineItems: object[]) =>
    call(invoices(), 'create', { customerId, dueDate: '2026-11-01', fromDate: '2026-10-01', toDate: '2026-10-31', vatEnabled: true, lineItems }, token);

  before(async () => {
    token = await loginAs(ADMIN_USER, ADMIN_PASSWORD);
    customerId = must(await call(client('customers', 'CustomersService'), 'create', { name: `Customer ${stamp}`, nameAr: 'عميل' }, token)).id;
    truckId = must(await call(client('trucks', 'TrucksService'), 'create', { truckNumber: `IT-${stamp}` }, token)).id;
  });

  test('invoice numbers keep working after an older invoice is deleted', async () => {
    const first = must(await newInvoice([{ description: 'Haul', quantity: '1', rate: '100' }]));
    must(await newInvoice([{ description: 'Haul', quantity: '1', rate: '100' }]));
    must(await call(invoices(), 'delete', { id: first.id }, token));
    const next = await newInvoice([{ description: 'Haul', quantity: '1', rate: '100' }]);
    assert.ok(next.ok, next.err?.description);
  });

  test('invoice totals are cent-exact sums of rounded lines', async () => {
    const inv = must(await newInvoice([{ description: 'A', quantity: '3', rate: '33.33' }, { description: 'B', quantity: '0.333', rate: '10.01' }]));
    assert.equal(cents(inv.subtotal), 10332);
    assert.equal(cents(inv.vatAmount), 1550);
    assert.equal(cents(inv.total), cents(inv.subtotal) + cents(inv.vatAmount));
    assert.equal(inv.lineItems.reduce((sum: number, l: any) => sum + cents(l.taxAmount), 0), cents(inv.vatAmount));
  });

  test('invalid invoices are rejected as INVALID_REQUEST', async () => {
    assert.equal((await newInvoice([])).err?.errorFilter, 'INVALID_REQUEST');
    assert.equal((await newInvoice([{ description: 'x', quantity: 'abc', rate: '1' }])).err?.errorFilter, 'INVALID_REQUEST');
  });

  test('a ZATCA-signed invoice can no longer change its amounts', async () => {
    const inv = must(await newInvoice([{ description: 'Haul', quantity: '2', rate: '50' }]));
    const signed = must(await call(invoices(), 'submitToZatca', { id: inv.id }, token));
    assert.equal(signed.zatcaStatus, 'SIGNED');
    const edit = await call(invoices(), 'update', { id: inv.id, lineItems: [{ description: 'x', quantity: '9', rate: '9' }] }, token);
    assert.equal(edit.err?.errorCode, 'FLEET-INV010');
  });

  test('work-order numbers survive deletion; completing sets a completion date; costs are exact', async () => {
    const wo = client('workshop', 'WorkOrdersService');
    const a = must(await call(wo, 'create', { truckId, issue: 'Brakes', laborCost: '0.10', partsCost: '0.20' }, token));
    assert.equal(cents(a.totalCost), 30);
    must(await call(wo, 'delete', { id: a.id }, token));
    const b = must(await call(wo, 'create', { truckId, issue: 'Oil' }, token));
    const done = must(await call(wo, 'update', { id: b.id, status: 'COMPLETED' }, token));
    assert.ok(done.completionDate);
  });

  test('database constraint errors come back as clear client errors', async () => {
    const trucks = client('trucks', 'TrucksService');
    const dup = await call(trucks, 'create', { truckNumber: `IT-${stamp}` }, token);
    assert.equal(dup.err?.errorFilter, 'INVALID_REQUEST');
    assert.match(dup.err?.errorCode ?? '', /^FLEET-(SYS005|TRK)/);
    const badRef = await call(
      client('trips', 'TripsService'),
      'create',
      { transactionNumber: `T${stamp}`, pickupLocationId: 999999, deliveryLocationId: 999999, cargoTypeId: 999999, quantity: '1', tripDate: '2026-01-01', truckId: 999999 },
      token,
    );
    assert.equal(badRef.err?.errorFilter, 'INVALID_REQUEST');
  });

  test('assignment edits cannot end before they start', async () => {
    const driver = must(await call(client('drivers', 'DriversService'), 'create', { name: `Driver ${stamp}` }, token));
    const as = client('assignments', 'AssignmentsService');
    const asg = must(await call(as, 'create', { truckId, driverId: driver.id, startDate: '2026-01-10' }, token));
    assert.equal((await call(as, 'update', { id: asg.id, endDate: '2026-01-01' }, token)).err?.errorFilter, 'INVALID_REQUEST');
  });
});
