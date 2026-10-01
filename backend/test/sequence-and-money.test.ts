import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWithSequence, nextInSequence } from '../utils/sequence.js';
import { fromCents, toCents } from '../utils/money.js';

const fmt = (n: number) => `INV-2026-${String(n).padStart(5, '0')}`;

test('nextInSequence: first number, and one past the newest suffix', () => {
  assert.equal(nextInSequence(null, fmt), 'INV-2026-00001');
  assert.equal(nextInSequence('INV-2026-00041', fmt), 'INV-2026-00042');
  // Year rolled over: the running number continues rather than restarting.
  assert.equal(nextInSequence('INV-2025-00099', fmt), 'INV-2026-00100');
  assert.equal(nextInSequence('garbage', fmt), 'INV-2026-00001');
});

test('createWithSequence retries with a fresh number when another request took it', async () => {
  let newest = 'INV-2026-00003';
  const tried: string[] = [];
  const result = await createWithSequence(
    async () => newest,
    fmt,
    async (value) => {
      tried.push(value);
      if (tried.length === 1) {
        newest = value; // a concurrent request created this number first
        throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      }
      return value;
    },
  );
  assert.deepEqual(tried, ['INV-2026-00004', 'INV-2026-00005']);
  assert.equal(result, 'INV-2026-00005');
});

test('createWithSequence does not retry other errors, and gives up after the attempt limit', async () => {
  await assert.rejects(
    createWithSequence(async () => null, fmt, async () => {
      throw Object.assign(new Error('FK'), { code: 'P2003' });
    }),
    /FK/,
  );
  let calls = 0;
  await assert.rejects(
    createWithSequence(
      async () => null,
      fmt,
      async () => {
        calls++;
        throw Object.assign(new Error('dup'), { code: 'P2002' });
      },
      3,
    ),
    /dup/,
  );
  assert.equal(calls, 3);
});

test('money: cents parsing and formatting', () => {
  assert.equal(toCents('99.95'), 9995);
  assert.equal(toCents('100'), 10000);
  assert.equal(toCents('0.1'), 10);
  assert.equal(toCents('1.234'), null);
  assert.equal(toCents('-5'), null);
  assert.equal(toCents('ten'), null);
  assert.equal(fromCents(9995), '99.95');
  assert.equal(fromCents(5), '0.05');
  assert.equal(fromCents((toCents('0.10') ?? 0) + (toCents('0.20') ?? 0)), '0.30');
});
