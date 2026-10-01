import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ErrorCode } from '../global_config/error-codes.js';
import { ErrorFilter } from '../models/api-response.js';
import { buildRegistry, REGISTRY_JSON, REGISTRY_MD, renderJson, renderMarkdown } from '../technical_dev_docs/generate-error-registry.js';

const entries = Object.entries(ErrorCode);

test('every error code is globally unique', () => {
  const seen = new Map<string, string>();
  for (const [key, entry] of entries) {
    assert.equal(seen.get(entry.code), undefined, `${entry.code} is used by both ${seen.get(entry.code)} and ${key}`);
    seen.set(entry.code, key);
  }
});

test('every error code follows FLEET-<MODULE><NUMBER> (or the standard RATE-429001)', () => {
  for (const [key, entry] of entries) assert.match(entry.code, /^(FLEET-[A-Z]+\d{3}|RATE-429001)$/, key);
});

test('only the six standard error filters are used', () => {
  const allowed = new Set<string>(Object.values(ErrorFilter));
  assert.equal(allowed.size, 6);
  for (const [key, entry] of entries) assert.ok(allowed.has(entry.filter), key);
});

test('descriptions are user-safe: no stack traces, SQL, file paths or internals', () => {
  for (const [key, entry] of entries) {
    assert.ok(entry.description.length > 0, key);
    assert.doesNotMatch(entry.description, /prisma|\.ts\b|\/app\/|node_modules|stack|undefined|null\b/i, key);
    assert.doesNotMatch(entry.description, /SELECT |INSERT |UPDATE |DELETE FROM/, key);
  }
});

test('error_codes_data.json and .md are in sync with the code (run `npm run docs:errors`)', () => {
  const registry = buildRegistry();
  assert.equal(registry.length, entries.length);
  assert.equal(fs.readFileSync(REGISTRY_JSON, 'utf8'), renderJson(registry));
  assert.equal(fs.readFileSync(REGISTRY_MD, 'utf8'), renderMarkdown(registry));
});

test('every registry row has all six documented fields filled in', () => {
  const rows = JSON.parse(fs.readFileSync(REGISTRY_JSON, 'utf8')) as Record<string, string>[];
  for (const row of rows) {
    assert.deepEqual(Object.keys(row), ['error_code', 'error_filter', 'error_description', 'module_name', 'file', 'function']);
    for (const [field, value] of Object.entries(row)) assert.ok(value, `${row.error_code}: ${field} is empty`);
  }
});
