/**
 * Authentication + authorization against a real running backend and
 * database. Creates its own role/user with a unique suffix, so it's safe
 * to run repeatedly against a dev database (never point it at production).
 */
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PASSWORD, ADMIN_USER, SKIP, call, client, loginAs, must } from './client.js';

describe('authentication and authorization', { skip: SKIP }, () => {
  const stamp = Date.now();
  const users = () => client('users', 'UsersService');
  const roles = () => client('roles', 'RolesService');
  let admin = '';
  let dispatcher = '';
  let dispatcherId = 0;

  before(async () => {
    admin = await loginAs(ADMIN_USER, ADMIN_PASSWORD);
    const role = must(await call(roles(), 'create', { name: `TRIPS_ONLY_${stamp}`, permissions: [{ module: 'trips', canView: true, canAdd: true }] }, admin));
    const user = must(
      await call(users(), 'create', { name: 'Dispatcher', email: `disp${stamp}@test.local`, username: `disp${stamp}`, password: 'DispPass123!', roleId: role.id, status: 'ACTIVE', language: 'en' }, admin),
    );
    dispatcherId = user.id;
    dispatcher = await loginAs(`disp${stamp}`, 'DispPass123!');
  });

  test('wrong password is rejected', async () => {
    const r = await call(client('auth', 'AuthService'), 'login', { username: ADMIN_USER, password: 'wrong' });
    assert.equal(r.err?.errorFilter, 'USER_NOT_AUTHENTICATED');
    assert.equal(r.err?.errorCode, 'FLEET-AUTH001');
  });

  test('missing and invalid tokens are rejected with distinct codes', async () => {
    assert.equal((await call(client('trucks', 'TrucksService'), 'list', {})).err?.errorCode, 'FLEET-AUTH003');
    assert.equal((await call(client('trucks', 'TrucksService'), 'list', {}, 'not.a.jwt')).err?.errorCode, 'FLEET-AUTH004');
  });

  test('a role without users/roles permissions cannot escalate', async () => {
    assert.equal((await call(users(), 'list', {}, dispatcher)).err?.errorFilter, 'USER_NOT_AUTHORIZED');
    const escalate = await call(users(), 'create', { name: 'E', email: `e${stamp}@test.local`, username: `e${stamp}`, password: 'EvilPass123!', roleId: 1, status: 'ACTIVE', language: 'en' }, dispatcher);
    assert.equal(escalate.err?.errorFilter, 'USER_NOT_AUTHORIZED');
    assert.equal((await call(roles(), 'update', { id: 1, permissions: [] }, dispatcher)).err?.errorFilter, 'USER_NOT_AUTHORIZED');
  });

  test('module permissions are enforced per action', async () => {
    assert.ok((await call(client('trips', 'TripsService'), 'list', {}, dispatcher)).ok);
    assert.equal((await call(client('trips', 'TripsService'), 'delete', { id: 1 }, dispatcher)).err?.errorFilter, 'USER_NOT_AUTHORIZED');
    assert.equal((await call(client('invoices', 'InvoicesService'), 'list', {}, dispatcher)).err?.errorFilter, 'USER_NOT_AUTHORIZED');
    assert.equal((await call(client('hr', 'EmployeesService'), 'list', {}, dispatcher)).err?.errorFilter, 'USER_NOT_AUTHORIZED');
    assert.equal((await call(client('workshop', 'WorkOrderPartsService'), 'list', {}, dispatcher)).err?.errorFilter, 'USER_NOT_AUTHORIZED');
  });

  test('shared lookup lists stay readable, but not writable', async () => {
    assert.ok((await call(client('trucks', 'TrucksService'), 'list', {}, dispatcher)).ok);
    assert.equal((await call(client('trucks', 'TrucksService'), 'create', { truckNumber: `X${stamp}` }, dispatcher)).err?.errorFilter, 'USER_NOT_AUTHORIZED');
  });

  test('effective permissions: dispatcher sees only trips; admin sees everything', async () => {
    const mine = must(await call(client('auth', 'AuthService'), 'getMyPermissions', {}, dispatcher)).permissions;
    assert.deepEqual(mine.filter((p: any) => p.canView).map((p: any) => p.module), ['trips']);
    const all = must(await call(client('auth', 'AuthService'), 'getMyPermissions', {}, admin)).permissions;
    assert.ok(all.length > 0 && all.every((p: any) => p.canView && p.canAdd && p.canEdit && p.canDelete));
  });

  test('administrators cannot lock themselves out', async () => {
    const me = must(await call(client('auth', 'AuthService'), 'getMe', {}, admin));
    assert.equal((await call(users(), 'update', { id: me.id, status: 'INACTIVE' }, admin)).err?.errorCode, 'FLEET-USR009');
    assert.equal((await call(users(), 'delete', { id: me.id }, admin)).err?.errorCode, 'FLEET-USR009');
  });

  test('deactivating a user ends their existing session immediately', async () => {
    must(await call(users(), 'update', { id: dispatcherId, status: 'INACTIVE' }, admin));
    const r = await call(client('trips', 'TripsService'), 'list', {}, dispatcher);
    assert.equal(r.err?.errorFilter, 'USER_NOT_AUTHENTICATED');
    assert.equal(r.err?.errorCode, 'FLEET-AUTH002');
  });
});
