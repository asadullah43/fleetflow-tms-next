import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PERMISSION_MODULES,
  effectivePermissions,
  isAdminRole,
  isAllowed,
  isPermissionModule,
} from '../src/common/auth/permissions.js';

const none = { canView: false, canAdd: false, canEdit: false, canDelete: false };

test('ADMIN may do anything, even with no permission rows', () => {
  for (const action of ['view', 'add', 'edit', 'delete'] as const) {
    assert.equal(isAllowed({ roleName: 'ADMIN', permission: null }, action), true);
  }
});

test('admin role name match ignores case and surrounding spaces', () => {
  assert.equal(isAdminRole(' admin '), true);
  assert.equal(isAdminRole('Administrator'), false);
  assert.equal(isAdminRole(null), false);
});

test('non-admin needs the exact flag for the action', () => {
  const viewer = { roleName: 'DISPATCHER', permission: { ...none, canView: true } };
  assert.equal(isAllowed(viewer, 'view'), true);
  assert.equal(isAllowed(viewer, 'add'), false);
  assert.equal(isAllowed(viewer, 'edit'), false);
  assert.equal(isAllowed(viewer, 'delete'), false);
});

test('a role with no row for the module is denied everything', () => {
  for (const action of ['view', 'add', 'edit', 'delete'] as const) {
    assert.equal(isAllowed({ roleName: 'DISPATCHER', permission: null }, action), false);
  }
});

test('effectivePermissions: every module present; admin gets all flags', () => {
  const admin = effectivePermissions('ADMIN', []);
  assert.equal(admin.length, PERMISSION_MODULES.length);
  assert.ok(admin.every((p) => p.canView && p.canAdd && p.canEdit && p.canDelete));
});

test('effectivePermissions: non-admin mirrors stored rows, missing modules are all-false', () => {
  const rows = [{ module: 'trips', canView: true, canAdd: true, canEdit: false, canDelete: false }];
  const perms = effectivePermissions('DISPATCHER', rows);
  assert.deepEqual(perms.find((p) => p.module === 'trips'), { module: 'trips', canView: true, canAdd: true, canEdit: false, canDelete: false });
  assert.deepEqual(perms.find((p) => p.module === 'users'), { module: 'users', ...none });
});

test('isPermissionModule only accepts known modules', () => {
  assert.equal(isPermissionModule('settings'), true);
  assert.equal(isPermissionModule('hax'), false);
  assert.equal(isPermissionModule(undefined), false);
});
