import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ApiError, errorMessage, isUnauthenticated } from '../lib/api/errors';
import { queryKeys } from '../lib/api/query-keys';
import { normalizeListQuery, toPage } from '../lib/api/types';
import { formatDate, formatDocumentDate, periodState, toDateInput, today } from '../lib/date';
import { AR_STRINGS } from '../lib/i18n/dictionary';
import { formatModule, moduleForPath } from '../lib/permissions';
import { STATUS_COLOR, statusLabel } from '../lib/status';
import { emptyValues, rowToValues, validateValues, valuesToPayload } from '../features/crud/form-mapping';
import type { FieldDef } from '../features/crud/types';
import { filledLines, lineProblems, previewTotals } from '../features/invoices/invoice-totals';
import { actions } from '../components/action-items';
import { crudRowActions } from '../features/crud/row-actions';

const ROOT = path.resolve(import.meta.dirname, '..');
/** Repo-relative path with forward slashes on every OS, so the guards below match on Windows too. */
const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join('/');

// ── API layer ───────────────────────────────────────────────────────────
test('list queries normalize to one cache key per distinct question', () => {
  assert.deepEqual(normalizeListQuery(), { page: 1, pageSize: 20, search: '', sortBy: undefined, sortOrder: undefined, filters: {} });
  assert.deepEqual(normalizeListQuery({ search: '  acme ', filters: { status: 'ACTIVE', customerId: '' }, sortBy: 'name' }), {
    page: 1,
    pageSize: 20,
    search: 'acme',
    sortBy: 'name',
    sortOrder: 'asc',
    filters: { status: 'ACTIVE' },
  });
  assert.deepEqual(queryKeys.list('trucks', { search: 'a ' }), queryKeys.list('trucks', { search: 'a', filters: {}, page: 1 }));
  assert.notDeepEqual(queryKeys.list('trucks', { page: 1 }), queryKeys.list('trucks', { page: 2 }));
});

test('every query of a resource sits under that resource key, so one invalidation refreshes them all', () => {
  for (const key of [queryKeys.list('trucks', {}), queryKeys.detail('trucks', 5), queryKeys.lookup('trucks', 'ab')]) assert.equal(key[0], queryKeys.resource('trucks')[0]);
});

test('a list response becomes a page even when the server omits pagination', () => {
  assert.deepEqual(toPage({ items: [1, 2] }, {}).pagination, { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 });
  assert.deepEqual(toPage({ items: null, pagination: { page: 3, pageSize: 10, totalItems: 25, totalPages: 3 } }, {}), { items: [], pagination: { page: 3, pageSize: 10, totalItems: 25, totalPages: 3 } });
});

test('ApiError carries the backend envelope and classifies itself', () => {
  const expired = new ApiError({ code: 'FLEET-AUTH004', filter: 'USER_NOT_AUTHENTICATED', message: 'Your session has expired.' });
  assert.equal(isUnauthenticated(expired), true);
  assert.equal(errorMessage(expired), 'Your session has expired.');
  assert.equal(isUnauthenticated(new ApiError({ code: 'FLEET-AUTH005', filter: 'USER_NOT_AUTHORIZED', message: 'no' })), false);
  assert.equal(errorMessage(new TypeError('x is undefined'), 'Save failed.'), 'Save failed.'); // internals never reach the user
  const limited = new ApiError({ code: 'RATE-429001', filter: 'RATE_LIMIT_EXCEEDED', message: 'wait', rateLimit: { type: 'USER', retryAfterSeconds: 30, remainingPoints: 0 } });
  assert.equal(limited.rateLimit?.retryAfterSeconds, 30);
});

// ── Dates (Day.js) ──────────────────────────────────────────────────────
test('dates: API timestamps read as the calendar date they were entered as', () => {
  assert.equal(toDateInput('2026-10-05T00:00:00.000Z'), '2026-10-05');
  assert.equal(toDateInput('2026-10-05'), '2026-10-05');
  assert.equal(toDateInput(''), '');
  assert.equal(toDateInput(undefined), '');
  assert.equal(formatDate(null), '—');
  assert.equal(formatDocumentDate('2026-10-05T09:30:00.000Z').slice(2), '-Oct-2026');
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/);
});

test('dates: an assignment period is upcoming, active or completed relative to today', () => {
  assert.equal(periodState('2000-01-01'), 'active');
  assert.equal(periodState('2000-01-01', '2000-12-31'), 'completed');
  assert.equal(periodState('2999-01-01'), 'upcoming');
  assert.equal(periodState(today(), today()), 'active');
});

// ── CRUD form mapping ───────────────────────────────────────────────────
const FIELDS: FieldDef[] = [
  { name: 'name', label: 'Name', required: true },
  { name: 'customerId', label: 'Customer', type: 'lookup' },
  { name: 'quantity', label: 'Qty', type: 'integer', default: '0' },
  { name: 'rate', label: 'Rate', type: 'decimal' },
  { name: 'tripDate', label: 'Date', type: 'date', required: true },
  { name: 'password', label: 'Password', type: 'password', required: true },
  { name: 'driver', label: 'Driver', type: 'display' },
];

test('form mapping: defaults, row -> form, form -> payload', () => {
  assert.deepEqual(emptyValues(FIELDS), { name: '', customerId: '', quantity: '0', rate: '', tripDate: '', password: '', driver: '' });
  assert.deepEqual(rowToValues(FIELDS, { name: 'A', customerId: 7, quantity: 3, rate: '10.5', tripDate: '2026-01-02T00:00:00.000Z', password: 'never-shown', driver: 'x' }), {
    name: 'A',
    customerId: '7',
    quantity: '3',
    rate: '10.5',
    tripDate: '2026-01-02',
    password: '',
    driver: '',
  });
  assert.equal(rowToValues(FIELDS, { customerId: 0 }).customerId, '', 'an unset reference (0) shows as empty');
  assert.deepEqual(valuesToPayload(FIELDS, { name: ' A ', customerId: '7', quantity: '3', rate: ' 10.5 ', tripDate: '2026-01-02', password: '', driver: 'ignored' }), {
    name: 'A',
    customerId: 7,
    quantity: 3,
    rate: '10.5',
    tripDate: '2026-01-02',
  });
  assert.equal('customerId' in valuesToPayload(FIELDS, { customerId: '' }), false, 'a blank reference is omitted, not sent as 0');
});

test('form validation: required, numeric formats, and password optional when editing', () => {
  const blank = emptyValues(FIELDS);
  assert.deepEqual(Object.keys(validateValues(FIELDS, blank, 'create')).sort(), ['name', 'password', 'tripDate']);
  assert.deepEqual(Object.keys(validateValues(FIELDS, blank, 'edit')).sort(), ['name', 'tripDate']);
  const typed = { ...blank, name: 'A', tripDate: '2026-01-01', password: 'x', quantity: '1.5', rate: 'abc' };
  assert.deepEqual(Object.keys(validateValues(FIELDS, typed, 'create')).sort(), ['quantity', 'rate']);
  for (const message of Object.values(validateValues(FIELDS, typed, 'create'))) assert.ok(message in AR_STRINGS, message);
});

// ── Invoices ────────────────────────────────────────────────────────────
test('invoice preview totals and line checks', () => {
  assert.deepEqual(previewTotals([{ description: 'a', quantity: '3', rate: '33.33' }, { description: 'b', quantity: 'x', rate: '5' }], true), { subtotal: '99.99', vat: '15.00', total: '114.99' });
  assert.deepEqual(previewTotals([{ description: 'a', quantity: '2', rate: '50' }], false), { subtotal: '100.00', vat: '0.00', total: '100.00' });
  const lines = [
    { description: 'Haul', quantity: '1', rate: '100' },
    { description: '', quantity: '1', rate: '0' }, // untouched trailing line
    { description: '', quantity: '2', rate: '10' },
    { description: 'Zero', quantity: '0', rate: '10' },
    { description: 'Bad', quantity: '1', rate: '1,5' },
  ];
  assert.deepEqual(Object.keys(lineProblems(lines)), ['2', '3', '4']);
  assert.equal(filledLines(lines).length, 3);
});

// ── Translations for values built at runtime ────────────────────────────
test('every known status label has an Arabic translation', () => {
  for (const status of Object.keys(STATUS_COLOR)) assert.ok(statusLabel(status) in AR_STRINGS, `${status} -> "${statusLabel(status)}"`);
  assert.equal(statusLabel('IN_PROGRESS'), 'In progress');
});

test("every permission module the backend defines has a translated name, and API keys have their own page module", () => {
  const source = fs.readFileSync(path.join(ROOT, '../backend/utils/permissions.ts'), 'utf8');
  const modules = [...source.slice(source.indexOf('PERMISSION_MODULES = ['), source.indexOf('] as const')).matchAll(/'(\w+)'/g)].map((match) => match[1]);
  assert.ok(modules.length >= 19);
  for (const name of modules) assert.ok(formatModule(name) in AR_STRINGS, `${name} -> "${formatModule(name)}"`);
  assert.equal(moduleForPath('/settings/api-keys'), 'apiKeys');
  assert.equal(moduleForPath('/settings/company'), 'settings');
});

// ── Architecture guards ─────────────────────────────────────────────────
function sourceFiles(dirs: string[]): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', '.next', 'generated'].includes(entry.name)) walk(full);
      } else if (/\.tsx?$/.test(entry.name)) files.push(full);
    }
  };
  dirs.forEach((dir) => walk(path.join(ROOT, dir)));
  return files;
}

test('screens never call the API or fetch in effects: data flows View -> ViewModel -> query/mutation -> API client', () => {
  const offenders: string[] = [];
  for (const file of sourceFiles(['app', 'components', 'features'])) {
    const relative = rel(file);
    const source = fs.readFileSync(file, 'utf8');
    // The transport is used only inside lib/api.
    if (/from '[./]+\/lib\/api\/client'/.test(source) && !relative.startsWith('features/auth/session-provider')) offenders.push(`${relative}: imports the API transport directly`);
    // No effect may start a request; effects are for timers, navigation and browser APIs only.
    for (const effect of source.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[/g)) {
      if (/Api\.\w+\(|apiCall\(|fetch\(/.test(effect[1])) offenders.push(`${relative}: fetches inside useEffect`);
    }
    // Views (.tsx screens) do not own server state: no API calls outside query/mutation functions.
    if (/Screen\.tsx$|View\.tsx$/.test(relative) && /\b\w+Api\.(list|get|create|update|remove)\w*\(/.test(source)) offenders.push(`${relative}: calls the API from a view`);
  }
  assert.deepEqual(offenders, []);
});

test('app/ holds routes only: every page re-exports a screen from features/', () => {
  for (const file of sourceFiles(['app']).filter((name) => name.endsWith('page.tsx'))) {
    const source = fs.readFileSync(file, 'utf8');
    if (rel(file) === 'app/page.tsx') continue; // the "/" redirect
    assert.match(source, /export \{ \w+ as default \} from '[./]+features\//, rel(file));
  }
});

test('styling is Mantine props: no stylesheets and no className-based styling in the app code', () => {
  const offenders = sourceFiles(['app', 'components', 'features', 'providers']).filter((file) => /className=|\.module\.css|globals\.css/.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(offenders.map(rel), []);
});

// ── Action menus ────────────────────────────────────────────────────────
test('every menu action carries its own label and icon, and calls exactly the handler it was given', () => {
  const expected: Record<string, [string, string, boolean]> = {
    view: ['View', 'eye', false],
    viewHistory: ['View history', 'eye', false],
    openPdf: ['Open PDF', 'fileText', false],
    edit: ['Edit', 'pencil', false],
    duplicate: ['Duplicate', 'copy', false],
    markPaid: ['Mark as paid', 'check', false],
    submitToZatca: ['Submit to ZATCA', 'send', false],
    delete: ['Delete', 'trash', true],
    deleteBatch: ['Delete batch', 'trash', true],
    remove: ['Remove', 'trash', true],
    revoke: ['Revoke', 'trash', true],
    exportExcel: ['Export to Excel', 'gridLayers', false],
    exportPdf: ['Export to PDF', 'fileText', false],
  };
  for (const [name, [label, icon, danger]] of Object.entries(expected)) {
    let called = 0;
    const item = (actions as unknown as Record<string, (onClick: () => void, state?: object) => { label: string; icon: string; danger?: boolean; onClick: () => void; hidden?: boolean }>)[name](() => called++, { hidden: true });
    assert.deepEqual([item.label, item.icon, item.danger === true, item.hidden], [label, icon, danger, true], name);
    item.onClick();
    assert.equal(called, 1, `${name} runs its handler`);
    assert.ok(label in AR_STRINGS, `${label} is translated`);
  }
  assert.deepEqual(Object.keys(actions).sort(), [...Object.keys(expected), 'add'].sort(), 'a new action needs a line in this test');
  assert.deepEqual([actions.add('Truck', () => {}).label, actions.add('Truck', () => {}).icon], ['Truck', 'plus']);
});

test('CRUD rows: Edit, Duplicate and Delete always sit in the 3-dot menu, each wired to its own handler and gated by its own permission', () => {
  const calls: string[] = [];
  const handlers = { onEdit: () => calls.push('edit'), onDuplicate: () => calls.push('duplicate'), onDelete: () => calls.push('delete') };
  const all = { view: true, add: true, edit: true, delete: true };

  const plain = crudRowActions({ allowed: all, ...handlers });
  assert.equal(plain.primary, undefined, 'no screen action → nothing promoted out of the menu');
  assert.deepEqual(plain.items.map((item) => item.label), ['Edit', 'Duplicate', 'Delete']);
  plain.items.forEach((item) => item.onClick());
  assert.deepEqual(calls, ['edit', 'duplicate', 'delete']);

  const visible = (allowed: typeof all) => crudRowActions({ allowed, ...handlers }).items.filter((item) => !item.hidden).map((item) => item.label);
  assert.deepEqual(visible({ ...all, edit: false }), ['Duplicate', 'Delete']);
  assert.deepEqual(visible({ ...all, add: false }), ['Edit', 'Delete']);
  assert.deepEqual(visible({ ...all, delete: false }), ['Edit', 'Duplicate']);
  assert.deepEqual(visible({ view: true, add: false, edit: false, delete: false }), []);

  let viewed = 0;
  const withView = crudRowActions({ allowed: all, custom: [actions.viewHistory(() => viewed++)], ...handlers });
  assert.equal(withView.primary?.label, 'View history');
  withView.primary?.onClick();
  assert.equal(viewed, 1);
  assert.deepEqual(withView.items.map((item) => item.label), ['Edit', 'Duplicate', 'Delete'], 'Edit stays in the menu next to a screen action');
});

test('actions are only offered through the shared ActionMenu: no ad-hoc menus, icon buttons or hand-built action items', () => {
  const offenders: string[] = [];
  // The sidebar fly-out is navigation, not an action menu.
  const MAY_USE_MENU = new Set(['components/ActionMenu.tsx', 'components/AppShell.tsx']);
  for (const file of sourceFiles(['app', 'components', 'features'])) {
    const relative = rel(file);
    const source = fs.readFileSync(file, 'utf8');
    const mantine = [...source.matchAll(/import \{([^}]*)\} from '@mantine\/core'/g)].flatMap((match) => match[1].split(',').map((name) => name.trim()));
    if (mantine.includes('ActionIcon') && relative !== 'components/ActionMenu.tsx') offenders.push(`${relative}: builds its own icon-button actions (use ActionMenu)`);
    if (mantine.includes('Menu') && !MAY_USE_MENU.has(relative)) offenders.push(`${relative}: builds its own menu (use ActionMenu)`);
    if (/\bmodals\.openConfirmModal\(/.test(source) && relative !== 'components/confirm.tsx') offenders.push(`${relative}: builds its own confirm dialog (use useConfirmDanger)`);
    // A row/toolbar action slot is always filled by ActionMenu…
    if (/\bactions=\{/.test(source) && !/from '[./]+(components\/)?ActionMenu'/.test(source)) offenders.push(`${relative}: fills an actions slot without ActionMenu`);
    // …and its items always come from the `actions` factory, where each label is bound to its icon.
    if (/from '[./]+(components\/)?ActionMenu'/.test(source) && /\bicon: '/.test(source)) offenders.push(`${relative}: hand-builds an action item (use actions.* from components/action-items)`);
  }
  assert.deepEqual(offenders, []);
});
