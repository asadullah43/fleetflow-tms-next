import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildZatcaQrTlv, zatcaTimestamp } from '../utils/zatca-qr.js';
import { buildLocalizedWriteData } from '../utils/language.js';

function decodeTlv(base64: string): Record<number, string> {
  const buf = Buffer.from(base64, 'base64');
  const out: Record<number, string> = {};
  for (let i = 0; i < buf.length; ) {
    const tag = buf[i];
    const len = buf[i + 1];
    out[tag] = buf.subarray(i + 2, i + 2 + len).toString('utf8');
    i += 2 + len;
  }
  return out;
}

test('ZATCA QR round-trips all five tags, including Arabic text', () => {
  const qr = buildZatcaQrTlv({
    sellerName: 'شركة النقل',
    vatNumber: '300000000000003',
    timestampIso: '2026-10-01T14:30:00Z',
    totalWithVat: '115.00',
    vatAmount: '15.00',
  });
  assert.deepEqual(decodeTlv(qr), {
    1: 'شركة النقل',
    2: '300000000000003',
    3: '2026-10-01T14:30:00Z',
    4: '115.00',
    5: '15.00',
  });
});

test('ZATCA QR refuses a value longer than one length byte can describe', () => {
  assert.throws(
    () => buildZatcaQrTlv({ sellerName: 'ش'.repeat(200), vatNumber: '', timestampIso: '', totalWithVat: '', vatAmount: '' }),
    /maximum is 255/,
  );
});

test('zatcaTimestamp drops milliseconds', () => {
  assert.equal(zatcaTimestamp(new Date('2026-10-01T14:30:00.123Z')), '2026-10-01T14:30:00Z');
});

test('localized write: explicit nameAr passes straight through (current frontend)', () => {
  assert.deepEqual(buildLocalizedWriteData({ name: 'Riyadh', nameAr: 'الرياض' }, true), { name: 'Riyadh', nameAr: 'الرياض' });
});

test('localized write: legacy language=ar routes name to nameAr, keeping English on update', () => {
  assert.deepEqual(buildLocalizedWriteData({ name: 'الرياض', language: 'ar' }, false), { nameAr: 'الرياض' });
  assert.deepEqual(buildLocalizedWriteData({ name: 'الرياض', language: 'ar' }, true), { name: 'الرياض', nameAr: 'الرياض' });
});
