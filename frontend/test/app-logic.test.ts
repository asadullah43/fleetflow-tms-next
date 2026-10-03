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
import { emptyValues, fieldsFor, rowToValues, validateValues, valuesToPayload } from '../features/crud/form-mapping';
import type { FieldDef } from '../features/crud/types';
import { filledLines, lineProblems, previewTotals } from '../features/invoices/invoice-totals';
import { actions } from '../components/action-items';
import { crudRowActions } from '../features/crud/row-actions';
import { fileChange, fileValueOf, withChosenFile } from '../features/files/file-value';
import { attendanceTimes, deriveAttendance, hoursBetween } from '../features/hr/attendance-times';
import { formatFileSize, uploadProblem } from '../lib/api/files.api';
import { combineDateTime, toTimeInput } from '../lib/date';

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

test('form mapping: a custom field (work-order inventory lines) keeps its own string value and is never sent or validated as-is', () => {
  const fields = [{ name: 'issue', label: 'Issue', required: true }, { name: 'parts', label: 'Inventory used', type: 'custom' as const, createOnly: true, default: '[]' }];
  assert.deepEqual(emptyValues(fields), { issue: '', parts: '[]' });
  assert.deepEqual(rowToValues(fields, { issue: 'Brakes', parts: 'anything from the row' }), { issue: 'Brakes', parts: '[]' }, 'a duplicated row starts with no lines');
  assert.deepEqual(valuesToPayload(fields, { issue: 'Brakes', parts: '[{"itemId":1}]' }), { issue: 'Brakes' }, "the definition's toApi turns it into payload");
  assert.deepEqual(validateValues(fields, { issue: 'x', parts: 'not json' }, 'create'), {});
});

test('form mapping: a file field sends only a change — the new upload, or 0 to remove — and duplicates never copy it', () => {
  const fields: FieldDef[] = [
    { name: 'documentType', label: 'Document type', required: true },
    { name: 'fileId', label: 'File', type: 'file', purpose: 'EMPLOYEE_DOCUMENT', fileFrom: 'file' },
  ];
  const attached = { id: 7, name: 'passport.pdf', contentType: 'application/pdf', size: 1000 };
  const uploaded = { id: 9, name: 'new.pdf', contentType: 'application/pdf', size: 2000 };

  // A new record: nothing chosen, nothing sent; a chosen upload is sent by id; chosen then removed is nothing again.
  assert.deepEqual(valuesToPayload(fields, emptyValues(fields)), { documentType: '' });
  assert.deepEqual(valuesToPayload(fields, { documentType: 'ID', fileId: withChosenFile('', uploaded) }), { documentType: 'ID', fileId: 9 });
  assert.equal(withChosenFile(withChosenFile('', uploaded), null), '', 'picked and removed before saving: as if never picked');

  // Editing: the attached file is shown and not re-sent; replacing sends the new id; removing sends 0.
  const opened = rowToValues(fields, { documentType: 'ID', fileId: 7, file: attached });
  assert.equal(opened.fileId, fileValueOf(attached));
  assert.equal('fileId' in valuesToPayload(fields, opened), false, 'unchanged: not sent');
  assert.equal(fileChange(withChosenFile(opened.fileId, uploaded)), 9);
  assert.equal(fileChange(withChosenFile(opened.fileId, null)), 0);
  assert.equal(fileChange(withChosenFile(withChosenFile(opened.fileId, null), attached)), undefined, 'removed then put back: unchanged');
  assert.deepEqual(rowToValues(fields, { documentType: 'ID' }), { documentType: 'ID', fileId: '' }, 'a record without a file');
  assert.deepEqual(validateValues(fields, { documentType: 'ID', fileId: 'not json' }, 'edit'), {});
});

test('form mapping: an edit-only field (leave status) is neither shown, checked nor sent with a new record — even a duplicate', () => {
  const fields: FieldDef[] = [
    { name: 'leaveType', label: 'Leave type', required: true },
    { name: 'status', label: 'Status', type: 'select', required: true, default: 'PENDING', editOnly: true },
    { name: 'parts', label: 'Inventory used', type: 'custom', createOnly: true },
  ];
  assert.deepEqual(fieldsFor(fields, 'create').map((field) => field.name), ['leaveType', 'parts']);
  assert.deepEqual(fieldsFor(fields, 'edit').map((field) => field.name), ['leaveType', 'status']);
  const duplicated = rowToValues(fields, { leaveType: 'ANNUAL', status: 'APPROVED' });
  assert.deepEqual(valuesToPayload(fieldsFor(fields, 'create'), duplicated), { leaveType: 'ANNUAL' }, 'a duplicate of an approved request is filed as a new (pending) one');
  assert.deepEqual(valuesToPayload(fieldsFor(fields, 'edit'), duplicated), { leaveType: 'ANNUAL', status: 'APPROVED' });
  assert.deepEqual(validateValues(fieldsFor(fields, 'create'), { leaveType: 'X', status: '' }, 'create'), {});
});

test('uploads: the browser refuses what the server would, before sending it', () => {
  const pdf = { name: 'scan.PDF', size: 5000, type: 'application/pdf' };
  assert.equal(uploadProblem(pdf), null);
  assert.equal(uploadProblem({ name: 'photo.jpeg', size: 5000, type: '' }), null, 'no type from the browser: the extension decides here (the server checks the content)');
  assert.equal(uploadProblem({ ...pdf, size: 10 * 1024 * 1024 }), null, 'exactly 10 MB is allowed');
  assert.match(uploadProblem({ ...pdf, size: 10 * 1024 * 1024 + 1 }) ?? '', /too large/);
  assert.match(uploadProblem({ name: 'contract.docx', size: 5000, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }) ?? '', /Only PDF files and images/);
  assert.match(uploadProblem({ ...pdf, size: 0 }) ?? '', /empty/);
  for (const file of [{ ...pdf, size: 0 }, { ...pdf, size: 11e6 }, { name: 'a.exe', size: 1, type: 'x' }]) assert.ok(uploadProblem(file)! in AR_STRINGS);
  assert.deepEqual([formatFileSize(300), formatFileSize(850 * 1024), formatFileSize(2.5 * 1024 * 1024)], ['1 KB', '850 KB', '2.5 MB']);
});

test('attendance: time in / out are times of day on the attendance date; a time out before the time in is the next morning', () => {
  assert.equal(toTimeInput(combineDateTime('2026-10-03', '08:15')), '08:15', 'round-trips in the viewer\'s time zone');
  assert.equal(toTimeInput(undefined), '');
  assert.equal(combineDateTime('', '08:00'), '');
  const day = attendanceTimes('2026-10-03', '08:00', '16:30');
  assert.equal(new Date(day.checkOut).getTime() - new Date(day.checkIn).getTime(), 8.5 * 3600e3);
  const night = attendanceTimes('2026-10-03', '22:00', '06:00');
  assert.equal(new Date(night.checkOut).getTime() - new Date(night.checkIn).getTime(), 8 * 3600e3, 'overnight shift ends the next day');
  assert.deepEqual(attendanceTimes('2026-10-03', '', ''), { checkIn: '', checkOut: '' }, "'' clears a time when editing");

  assert.deepEqual([hoursBetween('08:00', '16:30'), hoursBetween('22:00', '06:15'), hoursBetween('09:00', '09:20'), hoursBetween('08:00', ''), hoursBetween('08:00', '08:00')], ['8.5', '8.25', '0.33', '', '']);
});

test('attendance: hours worked follows the times until someone types their own number', () => {
  const start = { checkIn: '08:00', checkOut: '', hoursWorked: '' };
  const afterOut = deriveAttendance({ ...start, checkOut: '16:00' }, start, 'checkOut');
  assert.equal(afterOut.hoursWorked, '8');
  const later = deriveAttendance({ ...afterOut, checkOut: '17:30' }, afterOut, 'checkOut');
  assert.equal(later.hoursWorked, '9.5', 'still the worked-out value: follows the change');
  const typed = { ...later, hoursWorked: '9' };
  assert.equal(deriveAttendance({ ...typed, checkOut: '18:00' }, typed, 'checkOut').hoursWorked, '9', 'typed by hand: left alone');
  assert.equal(deriveAttendance({ ...later, checkIn: '' }, later, 'checkIn').hoursWorked, '', 'a time cleared: nothing to work out');
  assert.equal(deriveAttendance({ ...later, notes: 'x' }, later, 'notes').hoursWorked, '9.5', 'other fields do not touch it');
});

test('form validation: required, numeric formats, and password optional when editing', () => {
  const blank = emptyValues(FIELDS);
  assert.deepEqual(Object.keys(validateValues(FIELDS, blank, 'create')).sort(), ['name', 'password', 'tripDate']);
  assert.deepEqual(Object.keys(validateValues(FIELDS, blank, 'edit')).sort(), ['name', 'tripDate']);
  const typed = { ...blank, name: 'A', tripDate: '2026-01-01', password: 'x', quantity: '1.5', rate: 'abc' };
  assert.deepEqual(Object.keys(validateValues(FIELDS, typed, 'create')).sort(), ['quantity', 'rate']);
  for (const message of Object.values(validateValues(FIELDS, typed, 'create'))) assert.ok(message in AR_STRINGS, message);
  const time: FieldDef[] = [{ name: 'checkIn', label: 'Time in', type: 'time' }];
  assert.deepEqual(validateValues(time, { checkIn: '08:30' }, 'create'), {});
  assert.deepEqual(validateValues(time, { checkIn: '' }, 'create'), {});
  assert.equal(validateValues(time, { checkIn: '25:00' }, 'create').checkIn, 'Enter a time, e.g. 08:30.');
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
    inventoryUsed: ['Inventory used', 'box', false],
    openFile: ['Open file', 'eye', false],
    downloadFile: ['Download file', 'download', false],
    edit: ['Edit', 'pencil', false],
    duplicate: ['Duplicate', 'copy', false],
    markPaid: ['Mark as paid', 'check', false],
    submitToZatca: ['Submit to ZATCA', 'send', false],
    approve: ['Approve', 'check', false],
    reject: ['Reject', 'x', false],
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
