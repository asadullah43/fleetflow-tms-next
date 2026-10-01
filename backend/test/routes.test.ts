/**
 * The route table is the security and contract surface, so its shape is
 * asserted directly: every rpc is routed, returns the documented payload
 * type, and carries the middleware its kind of operation requires.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATABASE_URL ??= 'postgresql://unused@127.0.0.1:1/unused';
process.env.JWT_SECRET ??= 'unit-test-secret';
const { hasMessageType, listRpcs } = await import('../_core_app_connectivities/grpc-proto.js');
const { config } = await import('../global_config/index.js');
const { authenticate, authenticateIfPresent } = await import('../middlewares/authentication.js');
const { idempotency } = await import('../middlewares/idempotency.js');
const { allRoutes } = await import('../routes/index.js');

const routes = Object.entries(allRoutes).flatMap(([service, table]) => Object.entries(table).map(([method, definition]) => ({ rpc: `${service}/${method}`, service, method, definition })));

/** The only rpcs callable without credentials. */
const PUBLIC = new Set(['fleetflow.auth.AuthService/Login', 'fleetflow.companysettings.CompanySettingsService/GetBranding']);

test('every rpc in the proto contract has a route, and every route has an rpc', () => {
  assert.deepEqual(routes.map((r) => r.rpc).sort(), listRpcs().sort());
});

test('each route returns the payload type its proto comment documents', () => {
  const documented = new Map<string, string>();
  for (const file of fs.readdirSync(config.grpc.protoDir).filter((f) => f.endsWith('.proto'))) {
    const text = fs.readFileSync(path.join(config.grpc.protoDir, file), 'utf8');
    const pkg = /^package ([\w.]+);/m.exec(text)![1];
    for (const service of text.matchAll(/^service (\w+) \{([\s\S]*?)^\}/gm)) {
      for (const rpc of service[2].matchAll(/rpc (\w+)\([\w.]+\) returns \(fleetflow\.common\.ApiResponse\);\s*\/\/ DB_DATA: ([\w.]+)/g)) {
        documented.set(`${pkg}.${service[1]}/${rpc[1]}`, rpc[2].includes('.') ? rpc[2] : `${pkg}.${rpc[2]}`);
      }
    }
  }
  assert.equal(documented.size, routes.length, 'every rpc must return ApiResponse and document its DB_DATA type');
  for (const { rpc, definition } of routes) {
    assert.equal(definition.data, documented.get(rpc), rpc);
    assert.ok(hasMessageType(definition.data), `${rpc}: unknown type ${definition.data}`);
  }
});

test('every route except the public ones authenticates first', () => {
  for (const { rpc, definition } of routes) {
    if (PUBLIC.has(rpc)) assert.ok(!definition.middlewares.includes(authenticate), `${rpc} is meant to be public`);
    else assert.equal(definition.middlewares[0], authenticate, `${rpc} must start with authenticate`);
  }
  const branding = allRoutes['fleetflow.companysettings.CompanySettingsService'].GetBranding;
  assert.equal(branding.middlewares[0], authenticateIfPresent);
});

test('every authenticated route has an authorization step and input validation', () => {
  // authenticate + at least one of authorize/authorizeLookup/requireUserSession + validate; GetMyPermissions and
  // GetPermissionModules are open to any authenticated caller by design.
  const anyCaller = new Set(['fleetflow.auth.AuthService/GetMyPermissions', 'fleetflow.roles.RolesService/GetPermissionModules']);
  for (const { rpc, definition } of routes) {
    const minimum = PUBLIC.has(rpc) ? 1 : anyCaller.has(rpc) ? 2 : 3;
    assert.ok(definition.middlewares.length >= minimum, `${rpc} has ${definition.middlewares.length} middlewares`);
  }
});

test('every create operation is idempotent (honours Idempotency-Key)', () => {
  const creates = routes.filter((r) => r.method === 'Create');
  assert.ok(creates.length >= 30, `found ${creates.length} create routes`);
  for (const { rpc, definition } of creates) assert.ok(definition.middlewares.includes(idempotency), rpc);
});

test('operation kinds match the method (drives how constraint errors are worded)', () => {
  for (const { rpc, method, definition } of routes) {
    if (/^(List|Get)/.test(method)) assert.equal(definition.op, 'read', rpc);
    if (/^Delete/.test(method)) assert.equal(definition.op, 'delete', rpc);
  }
});
