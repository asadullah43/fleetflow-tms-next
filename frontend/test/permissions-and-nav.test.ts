import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasPermission, moduleForPath } from '../lib/permissions';
import { NAV_GROUPS, firstAllowedHref } from '../lib/nav-config';

test('every sidebar page maps to a permission module', () => {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      assert.ok(moduleForPath(item.href), `${item.href} has no permission module`);
    }
  }
});

test('moduleForPath matches whole path segments and nested pages', () => {
  assert.equal(moduleForPath('/trucks'), 'trucks');
  assert.equal(moduleForPath('/trucks/12'), 'trucks');
  assert.equal(moduleForPath('/hr/employees'), 'hr');
  assert.equal(moduleForPath('/inventory'), 'inventory'); // its own module, no longer part of the workshop
  assert.equal(moduleForPath('/inventory/warehouses'), 'inventory');
  assert.equal(moduleForPath('/settings/zatca'), 'settings');
  assert.equal(moduleForPath('/trucks-archive'), null); // not a prefix match on a different word
  assert.equal(moduleForPath('/login'), null);
});

test('hasPermission reads the matching flag, defaulting to no access', () => {
  const rows = [{ module: 'trips', canView: true, canAdd: false }];
  assert.equal(hasPermission(rows, 'trips', 'view'), true);
  assert.equal(hasPermission(rows, 'trips', 'add'), false);
  assert.equal(hasPermission(rows, 'users', 'view'), false);
  assert.equal(hasPermission(null, 'trips', 'view'), false);
});

test('sign-in lands on the dashboard when allowed, else the first viewable page', () => {
  assert.equal(firstAllowedHref(() => true), '/dashboard');
  assert.equal(firstAllowedHref((href) => href === '/invoices'), '/invoices');
  assert.equal(firstAllowedHref(() => false), '/dashboard');
});
