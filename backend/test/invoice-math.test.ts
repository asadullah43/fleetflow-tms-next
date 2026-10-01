import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeInvoice, InvoiceInputError } from '../src/modules/invoices/invoice-math.js';

const line = (quantity: string, rate: string, extra: Record<string, string> = {}) => ({ description: 'Haul', quantity, rate, ...extra });

test('simple 15% VAT invoice', () => {
  const r = computeInvoice([line('1', '100')], true, '15');
  assert.equal(r.subtotal, '100.00');
  assert.equal(r.vatAmount, '15.00');
  assert.equal(r.total, '115.00');
  assert.equal(r.rows[0].taxPercent, '15.00');
});

test('each line is rounded once, half-up, and totals are exact sums of the rounded lines', () => {
  // 3 x 33.33 = 99.99 (VAT 14.9985 -> 15.00); 0.333 x 10.01 = 3.33333 -> 3.33 (VAT 0.4995 -> 0.50)
  const r = computeInvoice([line('3', '33.33'), line('0.333', '10.01')], true, '15');
  assert.deepEqual(
    r.rows.map((x) => [x.amount, x.taxAmount]),
    [
      ['99.99', '15.00'],
      ['3.33', '0.50'],
    ],
  );
  assert.equal(r.subtotal, '103.32');
  assert.equal(r.vatAmount, '15.50');
  assert.equal(r.total, '118.82');
});

test('the classic float trap 0.1 + 0.2 stays exact', () => {
  const r = computeInvoice([line('1', '0.1'), line('1', '0.2')], false, '15');
  assert.equal(r.subtotal, '0.30');
  assert.equal(r.vatAmount, '0.00');
  assert.equal(r.total, '0.30');
});

test('VAT disabled: no tax is charged', () => {
  const r = computeInvoice([line('2', '50')], false, '15');
  assert.equal(r.vatAmount, '0.00');
  assert.equal(r.rows[0].taxPercent, '0.00');
});

test('per-line tax percent overrides the invoice default', () => {
  const r = computeInvoice([line('1', '100', { taxPercent: '5' })], true, '15');
  assert.equal(r.vatAmount, '5.00');
});

test('large quantity x rate near the column limit stays exact', () => {
  // 999999.999 x 9999.99 = 9999989990.00001 -> 9999989990.00 (fits Decimal(12,2))
  const r = computeInvoice([line('999999.999', '9999.99')], false, '0');
  assert.equal(r.subtotal, '9999989990.00');
});

test('amounts beyond what the database column holds are rejected, not silently rounded', () => {
  assert.throws(() => computeInvoice([line('999999999.999', '99999999.99')], false, '0'), InvoiceInputError);
});

test('invalid input is rejected with InvoiceInputError', () => {
  assert.throws(() => computeInvoice([line('abc', '1')], true, '15'), InvoiceInputError);
  assert.throws(() => computeInvoice([line('0', '1')], true, '15'), InvoiceInputError);
  assert.throws(() => computeInvoice([line('-1', '1')], true, '15'), InvoiceInputError);
  assert.throws(() => computeInvoice([{ description: '  ', quantity: '1', rate: '1' }], true, '15'), InvoiceInputError);
  assert.throws(() => computeInvoice([line('1', '1', { taxPercent: '150' })], true, '15'), InvoiceInputError);
});

test('blank per-line tax percent falls back to the invoice default', () => {
  const r = computeInvoice([line('1', '100', { taxPercent: '' })], true, '15');
  assert.equal(r.vatAmount, '15.00');
});
