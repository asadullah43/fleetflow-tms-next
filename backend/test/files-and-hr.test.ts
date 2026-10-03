/**
 * The pure parts of file uploads (type detection, safe names, signed
 * links) and of the HR rules added with them (attendance hours, the
 * leave apply / approve split). The end-to-end upload, download and
 * permission flows are in test/integration/hr-files.itest.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ??= 'postgresql://unused@127.0.0.1:1/unused';
process.env.JWT_SECRET ??= 'unit-test-secret';
const { cleanFileName, contentDisposition, detectFileType } = await import('../utils/file-type.js');
const { isValidLinkToken, canUpload } = await import('../services/files.service.js');
const { withAttendanceHours, leaveRequestsService } = await import('../services/hr.service.js');
const { PERMISSION_MODULES, principalCan } = await import('../utils/permissions.js');

const bytes = (...parts: (string | number[])[]) => new Uint8Array(parts.flatMap((part) => (typeof part === 'string' ? [...part].map((c) => c.charCodeAt(0)) : part)));

test('file type comes from the content: PDF, JPEG, PNG and WebP only', () => {
  assert.equal(detectFileType(bytes('%PDF-1.7\n...')), 'application/pdf');
  assert.equal(detectFileType(bytes([0x0a, 0x0a], '%PDF-1.4')), 'application/pdf', 'a little leading junk before %PDF- is accepted, as readers do');
  assert.equal(detectFileType(bytes([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])), 'image/jpeg');
  assert.equal(detectFileType(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), 'image/png');
  assert.equal(detectFileType(bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8 ')), 'image/webp');

  assert.equal(detectFileType(bytes('<html><script>alert(1)</script>')), null, 'HTML is refused whatever it is named');
  assert.equal(detectFileType(bytes('<?xml version="1.0"?><svg/>')), null, 'SVG (scriptable) is refused');
  assert.equal(detectFileType(bytes('PK', [3, 4])), null, 'Word / zip is refused');
  assert.equal(detectFileType(bytes('RIFF', [0, 0, 0, 0], 'WAVE')), null, 'other RIFF files are refused');
  assert.equal(detectFileType(new Uint8Array(2000).fill(0x20)), null, '%PDF- further in than 1 KB is not a PDF');
  assert.equal(detectFileType(new Uint8Array(0)), null);
});

test('uploaded file names are display-only and safe to echo back', () => {
  assert.equal(cleanFileName('C:\\scans\\..\\passport.pdf'), 'passport.pdf');
  assert.equal(cleanFileName('../../etc/passwd'), 'passwd');
  assert.equal(cleanFileName('a"b\u0000c\r\n.pdf'), 'abc.pdf');
  assert.equal(cleanFileName('   '), 'file');
  assert.equal(cleanFileName(undefined), 'file');
  const long = cleanFileName(`${'x'.repeat(400)}.pdf`);
  assert.equal(long.length, 150);
  assert.ok(long.endsWith('.pdf'), 'a long name keeps its extension');
  assert.equal(cleanFileName('عقد العمل.pdf'), 'عقد العمل.pdf', 'Arabic names are kept');

  assert.equal(contentDisposition('inline', 'عقد.pdf'), `inline; filename="___.pdf"; filename*=UTF-8''${encodeURIComponent('عقد.pdf')}`);
  assert.equal(contentDisposition('attachment', 'a b.pdf'), `attachment; filename="a b.pdf"; filename*=UTF-8''a%20b.pdf`);
});

test('signed file links: only for that file, only until they expire, and not forgeable', async () => {
  const now = Date.UTC(2026, 9, 3, 12, 0, 0);
  const { config } = await import('../global_config/index.js');
  const crypto = await import('node:crypto');
  const key = crypto.createHmac('sha256', config.auth.jwtSecret).update('fleetflow:file-links').digest();
  const issue = (id: number, expires: number) => `${expires}.${crypto.createHmac('sha256', key).update(`${id}.${expires}`).digest('base64url')}`;
  const expires = Math.floor(now / 1000) + 300;

  assert.equal(isValidLinkToken(7, issue(7, expires), now), true);
  assert.equal(isValidLinkToken(8, issue(7, expires), now), false, 'a link for one file does not open another');
  assert.equal(isValidLinkToken(7, issue(7, expires), (expires + 1) * 1000), false, 'expired');
  assert.equal(isValidLinkToken(7, issue(7, expires + 3600).replace(/^\d+/, String(expires)), now), false, 'the expiry cannot be edited');
  assert.equal(isValidLinkToken(7, 'garbage', now), false);
  assert.equal(isValidLinkToken(7, '', now), false);
});

test('uploading needs add or edit on the module the file is for; reading is checked separately (view)', () => {
  const flags = { canView: false, canAdd: false, canEdit: false, canDelete: false };
  const principal = (grant: Partial<typeof flags>) => ({ authMethod: 'JWT' as const, companyId: 1, userId: 2, apiKeyId: null, roleName: 'CLERK', permissions: [{ module: 'hr', ...flags, ...grant }] });
  assert.equal(canUpload(principal({ canAdd: true }), 'EMPLOYEE_DOCUMENT'), true);
  assert.equal(canUpload(principal({ canEdit: true }), 'CONTRACT_DOCUMENT'), true);
  assert.equal(canUpload(principal({ canView: true, canDelete: true }), 'EMPLOYEE_DOCUMENT'), false);
});

test('attendance: hours worked come from time in / time out unless typed by hand', () => {
  const at = (time: string) => new Date(`2026-10-03T${time}:00Z`);
  assert.equal(withAttendanceHours({ checkIn: at('08:00'), checkOut: at('16:30') }).hoursWorked, '8.50');
  assert.equal(withAttendanceHours({ checkIn: at('08:00'), checkOut: at('16:30'), hoursWorked: '7.5' }).hoursWorked, '7.5', 'a hand-entered value wins');
  assert.equal(withAttendanceHours({ checkIn: at('08:00'), checkOut: at('16:30'), hoursWorked: '' }).hoursWorked, '8.50', 'blank means "work it out"');
  assert.equal(withAttendanceHours({ checkIn: at('08:00') }).hoursWorked, undefined, 'only one time: nothing to work out');
  // Night shift: the form sends check-out on the next day.
  assert.equal(withAttendanceHours({ checkIn: at('22:00'), checkOut: new Date('2026-10-04T06:15:00Z') }).hoursWorked, '8.25');

  // Update: the other time comes from the stored row; changing nothing about the times leaves hours alone.
  assert.equal(withAttendanceHours({ checkOut: at('17:00') }, { checkIn: at('09:00'), checkOut: at('12:00') }).hoursWorked, '8.00');
  assert.equal(withAttendanceHours({ notes: 'x' }, { checkIn: at('09:00'), checkOut: at('12:00') }).hoursWorked, undefined);

  for (const [checkIn, checkOut] of [
    [at('16:00'), at('08:00')],
    [at('08:00'), at('08:00')],
    [at('08:00'), new Date('2026-10-04T08:01:00Z')],
  ]) {
    assert.throws(
      () => withAttendanceHours({ checkIn, checkOut }),
      (error: any) => error.errorCode === 'FLEET-HR010',
    );
  }
});

test('leave: "leaveRequests" is its own module; filing without the approve grant cannot set a decision', async () => {
  assert.ok((PERMISSION_MODULES as readonly string[]).includes('leaveRequests'));
  const applicant = { roleName: 'CLERK', permissions: [{ module: 'leaveRequests', canView: true, canAdd: true, canEdit: false, canDelete: false }] };
  const approver = { roleName: 'MANAGER', permissions: [{ module: 'leaveRequests', canView: true, canAdd: false, canEdit: true, canDelete: false }] };
  const hrOnly = { roleName: 'HR', permissions: [{ module: 'hr', canView: true, canAdd: true, canEdit: true, canDelete: true }] };
  assert.deepEqual([principalCan(applicant, 'leaveRequests', 'add'), principalCan(applicant, 'leaveRequests', 'edit')], [true, false]);
  assert.deepEqual([principalCan(approver, 'leaveRequests', 'add'), principalCan(approver, 'leaveRequests', 'edit')], [false, true]);
  assert.equal(principalCan(hrOnly, 'leaveRequests', 'view'), false, 'the hr grant no longer covers leave');

  // Rejected before any database access.
  for (const status of ['APPROVED', 'REJECTED']) {
    await assert.rejects(leaveRequestsService.create({ employeeId: 1, status }, { canDecide: false }), (error: any) => error.errorCode === 'FLEET-HR009');
    await assert.rejects(leaveRequestsService.create({ employeeId: 1, status }), (error: any) => error.errorCode === 'FLEET-HR009', 'callers that say nothing cannot decide');
  }
});
