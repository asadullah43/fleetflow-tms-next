/**
 * HR against a real running backend (gRPC + the HTTP file endpoint) and
 * database: uploading, attaching, opening and downloading employee
 * document and contract files (and what is refused), and the leave
 * "apply" / "approve" permission split.
 *
 * Needs INTEGRATION_GRPC_ADDR, and the file endpoint at
 * INTEGRATION_FILES_URL (default: port 8081 on the same host — or point
 * it at Envoy to cover its /files/ route too). INTEGRATION_FILE_MAX_BYTES
 * must match the backend's FILE_UPLOAD_MAX_BYTES (default 10 MB).
 * The cross-company test also needs DATABASE_URL (it provisions a company).
 */
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ADDR, ADMIN_PASSWORD, ADMIN_USER, SKIP, call, client, loginAs, must } from './client.js';

const FILES_URL = process.env.INTEGRATION_FILES_URL ?? (ADDR ? `http://${ADDR.split(':')[0]}:8081` : '');
const MAX_BYTES = Number(process.env.INTEGRATION_FILE_MAX_BYTES ?? 10 * 1024 * 1024);

const pdf = (text = 'contract') => new TextEncoder().encode(`%PDF-1.4\n% ${text}\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n`);
const png = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);

interface HttpResult {
  status: number;
  json?: any;
  text?: string;
  bytes?: Uint8Array;
  headers: Headers;
}

async function http(method: string, path: string, { token, body, headers = {} }: { token?: string; body?: BodyInit; headers?: Record<string, string> } = {}): Promise<HttpResult> {
  const response = await fetch(`${FILES_URL}${path}`, { method, body, headers: { ...headers, ...(token ? { authorization: `Bearer ${token}` } : {}) } });
  const type = response.headers.get('content-type') ?? '';
  if (type.startsWith('application/json')) return { status: response.status, json: await response.json(), headers: response.headers };
  if (type.startsWith('text/plain')) return { status: response.status, text: await response.text(), headers: response.headers };
  return { status: response.status, bytes: new Uint8Array(await response.arrayBuffer()), headers: response.headers };
}

function upload(token: string | undefined, purpose: string, bytes: Uint8Array, name = 'scan.pdf', type = 'application/pdf'): Promise<HttpResult> {
  const form = new FormData();
  form.append('file', new Blob([bytes.slice()], { type }), name);
  return http('POST', `/files?purpose=${purpose}`, { token, body: form });
}

/** Uploads and returns the new file's id (failing the test otherwise). */
async function uploaded(token: string, purpose: string, bytes = pdf(), name = 'scan.pdf'): Promise<number> {
  const result = await upload(token, purpose, bytes, name);
  assert.equal(result.status, 200, JSON.stringify(result.json));
  return result.json.DATA.id;
}

async function linkFor(token: string, id: number): Promise<HttpResult> {
  return http('POST', `/files/${id}/link`, { token });
}

describe('HR files and leave permissions (live backend)', { skip: SKIP }, () => {
  const stamp = Date.now();
  const hr = (service: string) => client('hr', service);
  let admin = '';
  let adminName = '';
  let employeeId = 0;
  /** Role tokens: hr viewer only; leave applicant; leave approver; hr-only (no leave grant). */
  let viewer = '';
  let applicant = '';
  let approver = '';
  let hrOnly = '';

  async function userWith(name: string, permissions: object[]): Promise<string> {
    const role = must(await call(client('roles', 'RolesService'), 'create', { name: `${name}_${stamp}`, permissions }, admin));
    const username = `${name.toLowerCase()}${stamp}`;
    must(
      await call(client('users', 'UsersService'), 'create', { name, email: `${username}@test.local`, username, password: 'TestPass123!', roleId: role.id, status: 'ACTIVE', language: 'en' }, admin),
    );
    return loginAs(username, 'TestPass123!');
  }

  before(async () => {
    admin = await loginAs(ADMIN_USER, ADMIN_PASSWORD);
    const me = must(await call(client('auth', 'AuthService'), 'getMe', {}, admin));
    adminName = me.name || me.username;
    const department = must(await call(hr('DepartmentsService'), 'create', { name: `Files ${stamp}` }, admin));
    employeeId = must(await call(hr('EmployeesService'), 'create', { name: `File Holder ${stamp}`, departmentId: department.id, joiningDate: '2026-01-01', salary: '9000' }, admin)).id;
    viewer = await userWith('HRVIEW', [{ module: 'hr', canView: true }]);
    applicant = await userWith('APPLY', [{ module: 'leaveRequests', canView: true, canAdd: true }]);
    approver = await userWith('APPROVE', [{ module: 'leaveRequests', canView: true, canEdit: true }]);
    hrOnly = await userWith('HRONLY', [{ module: 'hr', canView: true, canAdd: true, canEdit: true, canDelete: true }]);
  });

  // ── Upload: what is accepted and what is refused ────────────────────────

  test('a PDF uploads: type detected from the content, original name kept for display', async () => {
    const result = await upload(admin, 'EMPLOYEE_DOCUMENT', pdf(), 'Iqama scan.pdf');
    assert.equal(result.status, 200);
    assert.equal(result.json.STATUS, 'SUCCESSFUL');
    assert.equal(result.json.DATA.name, 'Iqama scan.pdf');
    assert.equal(result.json.DATA.contentType, 'application/pdf');
    assert.equal(result.json.DATA.size, pdf().length);
    assert.equal(result.json.DATA.uploadedBy, adminName);
    // An image is fine too — and the browser's claimed type does not matter, the content does.
    const image = await upload(admin, 'EMPLOYEE_DOCUMENT', png(), 'photo.bin', 'application/octet-stream');
    assert.equal(image.json.DATA.contentType, 'image/png');
  });

  test('a file that is not a PDF or an image is refused, whatever it is named or claims to be', async () => {
    for (const [bytes, name, type] of [
      [new TextEncoder().encode('<html><script>alert(1)</script></html>'), 'contract.pdf', 'application/pdf'],
      [new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'logo.svg', 'image/svg+xml'],
      [new Uint8Array([0x50, 0x4b, 3, 4, 0, 0]), 'contract.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ] as const) {
      const result = await upload(admin, 'EMPLOYEE_DOCUMENT', bytes, name, type);
      assert.equal(result.status, 400, name);
      assert.equal(result.json.ERROR_CODE, 'FLEET-FIL003', name);
      assert.equal(result.json.ERROR_FILTER, 'INVALID_REQUEST');
    }
  });

  test('a file over the size limit is refused; one exactly at the limit is accepted', async () => {
    const over = new Uint8Array(MAX_BYTES + 1);
    over.set(pdf());
    const refused = await upload(admin, 'EMPLOYEE_DOCUMENT', over, 'huge.pdf');
    assert.equal(refused.status, 413);
    assert.equal(refused.json.ERROR_CODE, 'FLEET-FIL002');
    assert.match(refused.json.ERROR_DESCRIPTION, /largest file you can upload is \d+(\.\d)? MB/);

    const exact = new Uint8Array(MAX_BYTES);
    exact.set(pdf());
    const accepted = await upload(admin, 'EMPLOYEE_DOCUMENT', exact, 'exact.pdf');
    assert.equal(accepted.status, 200, JSON.stringify(accepted.json));
    assert.equal(accepted.json.DATA.size, MAX_BYTES);
  });

  test('upload needs a session, a known purpose, a multipart body with a file, and add/edit on its module', async () => {
    assert.equal((await upload(undefined, 'EMPLOYEE_DOCUMENT', pdf())).json.ERROR_CODE, 'FLEET-AUTH003');
    assert.equal((await upload('not.a.jwt', 'EMPLOYEE_DOCUMENT', pdf())).json.ERROR_CODE, 'FLEET-AUTH004');
    assert.equal((await upload(admin, 'PAYSLIP', pdf())).json.ERROR_CODE, 'FLEET-FIL010');
    const json = await http('POST', '/files?purpose=EMPLOYEE_DOCUMENT', { token: admin, body: JSON.stringify({ file: 'x' }), headers: { 'content-type': 'application/json' } });
    assert.equal(json.json.ERROR_CODE, 'FLEET-FIL011');
    const noFile = new FormData();
    noFile.append('other', 'x');
    assert.equal((await http('POST', '/files?purpose=EMPLOYEE_DOCUMENT', { token: admin, body: noFile })).json.ERROR_CODE, 'FLEET-FIL001');

    const denied = await upload(viewer, 'EMPLOYEE_DOCUMENT', pdf());
    assert.equal(denied.status, 403);
    assert.equal(denied.json.ERROR_FILTER, 'USER_NOT_AUTHORIZED');
    assert.equal((await upload(applicant, 'CONTRACT_DOCUMENT', pdf())).status, 403, 'leave rights are not HR document rights');
  });

  // ── Attach, open, download, replace, remove ─────────────────────────────

  test('employee document: attach on create, open inline and download through a signed link', async () => {
    const fileId = await uploaded(admin, 'EMPLOYEE_DOCUMENT', pdf('passport'), 'passport.pdf');
    const doc = must(await call(hr('EmployeeDocumentsService'), 'create', { employeeId, documentType: 'PASSPORT', fileId }, admin));
    assert.equal(doc.fileId, fileId);
    assert.equal(doc.fileUrl, `/files/${fileId}`);
    assert.equal(doc.file.name, 'passport.pdf');
    assert.equal(doc.file.contentType, 'application/pdf');

    // The list shows it too.
    const listed = must(await call(hr('EmployeeDocumentsService'), 'list', { filters: { employeeId: String(employeeId) } }, admin)).items.find((row: any) => row.id === doc.id);
    assert.equal(listed.file.name, 'passport.pdf');

    const link = await linkFor(viewer, fileId); // view permission is enough to read
    assert.equal(link.status, 200);
    assert.match(link.json.DATA.url, new RegExp(`^/files/${fileId}\\?token=`));
    assert.ok(new Date(link.json.DATA.expiresAt).getTime() > Date.now());

    const inline = await http('GET', link.json.DATA.url);
    assert.equal(inline.status, 200);
    assert.deepEqual(inline.bytes, pdf('passport'));
    assert.equal(inline.headers.get('content-type'), 'application/pdf');
    assert.match(inline.headers.get('content-disposition') ?? '', /^inline; filename="passport\.pdf"/);
    assert.equal(inline.headers.get('x-content-type-options'), 'nosniff');
    assert.match(inline.headers.get('cache-control') ?? '', /no-store/);

    const download = await http('GET', `${link.json.DATA.url}&download=1`);
    assert.match(download.headers.get('content-disposition') ?? '', /^attachment; filename="passport\.pdf"/);

    // Integrations read it with their normal credentials instead of a link.
    assert.deepEqual((await http('GET', `/files/${fileId}`, { token: admin })).bytes, pdf('passport'));
  });

  test('links: a forged, altered or other-file token is refused; reading needs view permission', async () => {
    const fileId = await uploaded(admin, 'EMPLOYEE_DOCUMENT');
    const otherId = await uploaded(admin, 'EMPLOYEE_DOCUMENT');
    const { url } = (await linkFor(admin, fileId)).json.DATA;
    const token = new URL(url, 'http://x').searchParams.get('token')!;
    const [expires, signature] = token.split('.');

    for (const bad of [`/files/${otherId}?token=${token}`, `/files/${fileId}?token=${Number(expires) + 86400}.${signature}`, `/files/${fileId}?token=x.y`]) {
      const result = await http('GET', bad);
      assert.equal(result.status, 403, bad);
      assert.match(result.text ?? '', /link has expired/, 'a browser tab gets readable text, not JSON');
    }
    assert.equal((await http('GET', `/files/${fileId}`)).json.ERROR_CODE, 'FLEET-AUTH003', 'no link, no credentials');
    assert.equal((await linkFor(approver, fileId)).json.ERROR_FILTER, 'USER_NOT_AUTHORIZED', 'leave rights do not open HR documents');
    assert.equal((await http('GET', `/files/${fileId}`, { token: applicant })).status, 403);
    assert.equal((await linkFor(admin, 999999999)).json.ERROR_CODE, 'FLEET-FIL004');
  });

  test('a file belongs to one record of its own kind', async () => {
    const fileId = await uploaded(admin, 'EMPLOYEE_DOCUMENT');
    must(await call(hr('EmployeeDocumentsService'), 'create', { employeeId, documentType: 'ID', fileId }, admin));
    assert.equal((await call(hr('EmployeeDocumentsService'), 'create', { employeeId, documentType: 'ID copy', fileId }, admin)).err?.errorCode, 'FLEET-FIL008');
    const contractUpload = await uploaded(admin, 'CONTRACT_DOCUMENT');
    assert.equal((await call(hr('EmployeeDocumentsService'), 'create', { employeeId, documentType: 'X', fileId: contractUpload }, admin)).err?.errorCode, 'FLEET-FIL009');
    assert.equal((await call(hr('EmployeeDocumentsService'), 'create', { employeeId, documentType: 'X', fileId: 999999999 }, admin)).err?.errorCode, 'FLEET-FIL004');
  });

  test('replacing a document file deletes the old one; 0 removes it; deleting the record deletes its file', async () => {
    const first = await uploaded(admin, 'EMPLOYEE_DOCUMENT', pdf('v1'));
    const doc = must(await call(hr('EmployeeDocumentsService'), 'create', { employeeId, documentType: 'LICENSE', fileId: first }, admin));

    // Editing other fields leaves the file alone.
    assert.equal(must(await call(hr('EmployeeDocumentsService'), 'update', { id: doc.id, documentNumber: 'L-1' }, admin)).fileId, first);

    const second = await uploaded(admin, 'EMPLOYEE_DOCUMENT', pdf('v2'));
    const replaced = must(await call(hr('EmployeeDocumentsService'), 'update', { id: doc.id, fileId: second }, admin));
    assert.equal(replaced.fileId, second);
    assert.equal(replaced.fileUrl, `/files/${second}`);
    assert.equal((await http('GET', `/files/${first}`, { token: admin })).json.ERROR_CODE, 'FLEET-FIL004', 'the replaced file is gone');

    const removed = must(await call(hr('EmployeeDocumentsService'), 'update', { id: doc.id, fileId: 0 }, admin));
    assert.ok(!removed.fileId && !removed.fileUrl && !removed.file);
    assert.equal((await http('GET', `/files/${second}`, { token: admin })).json.ERROR_CODE, 'FLEET-FIL004');

    const third = await uploaded(admin, 'EMPLOYEE_DOCUMENT', pdf('v3'));
    must(await call(hr('EmployeeDocumentsService'), 'update', { id: doc.id, fileId: third }, admin));
    must(await call(hr('EmployeeDocumentsService'), 'delete', { id: doc.id }, admin));
    assert.equal((await http('GET', `/files/${third}`, { token: admin })).json.ERROR_CODE, 'FLEET-FIL004');
  });

  test('contract: the document columns are set from the real upload', async () => {
    const before = Date.now();
    const fileId = await uploaded(admin, 'CONTRACT_DOCUMENT', pdf('signed'), 'عقد العمل.pdf');
    const contract = must(await call(hr('EmploymentContractsService'), 'create', { employeeId, contractNumber: `C-${stamp}`, startDate: '2026-01-01', documentFileId: fileId }, admin));
    assert.equal(contract.documentFileId, fileId);
    assert.equal(contract.documentUrl, `/files/${fileId}`);
    assert.equal(contract.documentUploadedBy, adminName);
    const uploadedAt = new Date(contract.documentUploadedAt).getTime();
    assert.ok(uploadedAt >= before - 5000 && uploadedAt <= Date.now() + 5000, 'documentUploadedAt is the upload time');
    assert.equal(contract.documentFile.name, 'عقد العمل.pdf');

    const { url } = (await linkFor(admin, fileId)).json.DATA;
    const download = await http('GET', `${url}&download=1`);
    assert.deepEqual(download.bytes, pdf('signed'));
    assert.match(download.headers.get('content-disposition') ?? '', new RegExp(`filename\\*=UTF-8''${encodeURIComponent('عقد العمل.pdf')}`));

    // Removing it clears every document column.
    const cleared = must(await call(hr('EmploymentContractsService'), 'update', { id: contract.id, documentFileId: 0 }, admin));
    assert.ok(!cleared.documentFileId && !cleared.documentUrl && !cleared.documentUploadedAt && !cleared.documentUploadedBy);
    assert.equal((await call(hr('EmploymentContractsService'), 'update', { id: contract.id, documentFileId: await uploaded(admin, 'EMPLOYEE_DOCUMENT') }, admin)).err?.errorCode, 'FLEET-FIL009');
  });

  test("another company can neither read nor attach this company's files", { skip: !process.env.DATABASE_URL && 'set DATABASE_URL to provision a second company' }, async () => {
    const fileId = await uploaded(admin, 'EMPLOYEE_DOCUMENT');
    const { provisioningService } = await import('../../services/provisioning.service.js');
    const username = `filesb${stamp}`;
    await provisioningService.createCompany({ companyName: `Files B ${stamp}`, adminEmail: `${username}@test.local`, adminUsername: username, adminPassword: 'TenantB123!' });
    const tokenB = await loginAs(username, 'TenantB123!');

    assert.equal((await linkFor(tokenB, fileId)).json.ERROR_CODE, 'FLEET-FIL004');
    assert.equal((await http('GET', `/files/${fileId}`, { token: tokenB })).json.ERROR_CODE, 'FLEET-FIL004');
    const department = must(await call(hr('DepartmentsService'), 'create', { name: 'B' }, tokenB));
    const employeeB = must(await call(hr('EmployeesService'), 'create', { name: 'B', departmentId: department.id, joiningDate: '2026-01-01' }, tokenB));
    const attach = await call(hr('EmployeeDocumentsService'), 'create', { employeeId: employeeB.id, documentType: 'X', fileId }, tokenB);
    assert.ok(['FLEET-FIL004', 'FLEET-SYS006'].includes(attach.err?.errorCode ?? ''), attach.err?.errorCode);
  });

  // ── Leave: apply (add) vs approve (edit) ───────────────────────────────

  test('apply only: can file a request (always Pending) but cannot approve, reject or file it pre-approved', async () => {
    const filed = must(await call(hr('LeaveRequestsService'), 'create', { employeeId, leaveType: 'ANNUAL', startDate: '2026-11-01', endDate: '2026-11-03', days: 3 }, applicant));
    assert.equal(filed.status, 'PENDING');

    const preApproved = await call(hr('LeaveRequestsService'), 'create', { employeeId, leaveType: 'ANNUAL', startDate: '2026-11-10', endDate: '2026-11-11', days: 2, status: 'APPROVED' }, applicant);
    assert.equal(preApproved.err?.errorCode, 'FLEET-HR009');
    assert.equal(preApproved.err?.errorFilter, 'USER_NOT_AUTHORIZED');

    for (const status of ['APPROVED', 'REJECTED']) {
      const decided = await call(hr('LeaveRequestsService'), 'update', { id: filed.id, status }, applicant);
      assert.equal(decided.err?.errorCode, 'FLEET-AUTH005', status);
    }
    assert.equal(must(await call(hr('LeaveRequestsService'), 'get', { id: filed.id }, admin)).status, 'PENDING', 'still pending');
  });

  test('approve only: can approve or reject, but cannot file a request', async () => {
    const filed = must(await call(hr('LeaveRequestsService'), 'create', { employeeId, leaveType: 'SICK', startDate: '2026-12-01', endDate: '2026-12-01', days: 1 }, applicant));
    assert.equal(must(await call(hr('LeaveRequestsService'), 'update', { id: filed.id, status: 'APPROVED' }, approver)).status, 'APPROVED');
    assert.equal(must(await call(hr('LeaveRequestsService'), 'update', { id: filed.id, status: 'REJECTED' }, approver)).status, 'REJECTED');

    const create = await call(hr('LeaveRequestsService'), 'create', { employeeId, leaveType: 'SICK', startDate: '2026-12-05', endDate: '2026-12-05', days: 1 }, approver);
    assert.equal(create.err?.errorCode, 'FLEET-AUTH005');
    assert.equal((await call(hr('LeaveRequestsService'), 'delete', { id: filed.id }, approver)).err?.errorCode, 'FLEET-AUTH005', 'no delete grant');
  });

  test('both grants: can file a request already decided', async () => {
    const both = await userWith('LEAVEALL', [{ module: 'leaveRequests', canView: true, canAdd: true, canEdit: true }]);
    const filed = must(await call(hr('LeaveRequestsService'), 'create', { employeeId, leaveType: 'ANNUAL', startDate: '2026-12-20', endDate: '2026-12-21', days: 2, status: 'APPROVED' }, both));
    assert.equal(filed.status, 'APPROVED');
  });

  test('"hr" alone no longer covers leave; leave alone sees employees for picking, without personal details', async () => {
    assert.equal((await call(hr('LeaveRequestsService'), 'list', {}, hrOnly)).err?.errorFilter, 'USER_NOT_AUTHORIZED');
    assert.equal(
      (await call(hr('LeaveRequestsService'), 'create', { employeeId, leaveType: 'X', startDate: '2026-12-01', endDate: '2026-12-01', days: 1 }, hrOnly)).err?.errorFilter,
      'USER_NOT_AUTHORIZED',
    );

    const picked = must(await call(hr('EmployeesService'), 'list', { search: `File Holder ${stamp}` }, applicant)).items;
    assert.equal(picked.length, 1);
    assert.equal(picked[0].id, employeeId);
    assert.ok(picked[0].employeeNumber);
    assert.ok(!picked[0].salary, 'no salary for a leave-only role');
    const gotByApprover = must(await call(hr('EmployeesService'), 'get', { id: employeeId }, approver));
    assert.ok(!gotByApprover.salary && !gotByApprover.phone && !gotByApprover.idNumber, 'nor on get');
    assert.equal(gotByApprover.name, `File Holder ${stamp}`);
    assert.equal(must(await call(hr('EmployeesService'), 'get', { id: employeeId }, viewer)).salary, '9000', 'HR view still sees everything');
    assert.equal((await call(hr('EmployeesService'), 'create', { name: 'X', departmentId: 1, joiningDate: '2026-01-01' }, applicant)).err?.errorFilter, 'USER_NOT_AUTHORIZED');
    assert.equal((await call(hr('DepartmentsService'), 'list', {}, applicant)).err?.errorFilter, 'USER_NOT_AUTHORIZED');
  });

  test('the Roles page lists leaveRequests as its own module', async () => {
    const modules = must(await call(client('roles', 'RolesService'), 'getPermissionModules', {}, admin)).modules;
    assert.ok(modules.includes('leaveRequests') && modules.includes('hr'));
  });

  // ── Attendance: time in / time out ─────────────────────────────────────

  test('attendance: hours worked from time in / out (overnight too), a typed value wins, bad times are refused', async () => {
    const att = hr('AttendanceService');
    const day = (n: number) => `2026-0${(n % 9) + 1}-1${n % 10}`;
    const base = (n: number) => ({ employeeId, attendDate: day(n) });
    const shift = must(await call(att, 'create', { ...base(1), checkIn: '2026-02-11T05:00:00.000Z', checkOut: '2026-02-11T13:30:00.000Z' }, admin));
    assert.equal(shift.hoursWorked, '8.5');
    assert.equal(shift.checkIn, '2026-02-11T05:00:00.000Z');

    const night = must(await call(att, 'create', { ...base(2), checkIn: '2026-03-12T19:00:00.000Z', checkOut: '2026-03-13T03:15:00.000Z' }, admin));
    assert.equal(night.hoursWorked, '8.25');

    const typed = must(await call(att, 'create', { ...base(3), checkIn: '2026-04-13T05:00:00.000Z', checkOut: '2026-04-13T13:00:00.000Z', hoursWorked: '7' }, admin));
    assert.equal(typed.hoursWorked, '7');

    // Update one time: worked out against the stored other one.
    assert.equal(must(await call(att, 'update', { id: shift.id, checkOut: '2026-02-11T15:00:00.000Z' }, admin)).hoursWorked, '10');
    // Clearing a time ('' from the form) clears it.
    assert.ok(!must(await call(att, 'update', { id: shift.id, checkOut: '' }, admin)).checkOut);

    const backwards = await call(att, 'create', { ...base(4), checkIn: '2026-05-14T13:00:00.000Z', checkOut: '2026-05-14T05:00:00.000Z' }, admin);
    assert.equal(backwards.err?.errorCode, 'FLEET-HR010');
  });
});
