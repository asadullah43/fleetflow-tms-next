/**
 * Guards the tenant-isolation tables in _core_app_connectivities/prisma.ts
 * against drifting from prisma/schema.prisma: a model that gains a
 * companyId, or a new foreign key to a tenant model, must be registered
 * or this fails.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DATABASE_URL ??= 'postgresql://unused@127.0.0.1:1/unused';
const { TENANT_MODELS, TENANT_REFERENCES } = await import('../_core_app_connectivities/prisma.js');

const schema = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../prisma/schema.prisma'), 'utf8');
const models = new Map<string, string>([...schema.matchAll(/^model (\w+) \{\n([\s\S]*?)^\}/gm)].map((m) => [m[1], m[2]]));
const delegate = (model: string) => model[0].toLowerCase() + model.slice(1);

test('TENANT_MODELS is exactly the set of models with a companyId column', () => {
  const withCompany = [...models].filter(([, body]) => /^\s+companyId\s+Int\b/m.test(body)).map(([name]) => name);
  assert.deepEqual([...TENANT_MODELS].sort(), withCompany.sort());
});

test('every model without companyId is a known child or the tenant root', () => {
  const unscoped = [...models.keys()].filter((name) => !TENANT_MODELS.has(name)).sort();
  // Children are only ever reached through their (tenant-scoped) parent.
  assert.deepEqual(unscoped, ['Company', 'InvoiceLineItem', 'Permission', 'ZatcaSubmissionLog']);
});

test('every foreign key from a tenant model to another tenant model is verified on write', () => {
  for (const [model, body] of models) {
    if (!TENANT_MODELS.has(model)) continue;
    const expected: Record<string, string> = {};
    for (const relation of body.matchAll(/^\s+\w+\s+(\w+)\??\s+@relation\([^)]*fields: \[(\w+)\]/gm)) {
      const [, target, column] = relation;
      if (column !== 'companyId' && TENANT_MODELS.has(target)) expected[column] = delegate(target);
    }
    assert.deepEqual(TENANT_REFERENCES[model] ?? {}, expected, `TENANT_REFERENCES.${model}`);
  }
});

test('business identifiers are unique per company, not globally', () => {
  for (const [model, column] of [
    ['Truck', 'truckNumber'],
    ['Trip', 'transactionNumber'],
    ['Invoice', 'invoiceNumber'],
    ['LoadingOrder', 'serialNumber'],
    ['WorkOrder', 'orderNumber'],
    ['Employee', 'employeeNumber'],
    ['Role', 'name'],
  ]) {
    const body = models.get(model) ?? '';
    assert.match(body, new RegExp(`@@unique\\(\\[companyId, ${column}\\]\\)`), `${model}.${column}`);
    assert.doesNotMatch(body, new RegExp(`^\\s+${column}\\s+\\S+.*@unique`, 'm'), `${model}.${column} must not be globally unique`);
  }
});
