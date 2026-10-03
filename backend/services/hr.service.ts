import { prisma } from '../_core_app_connectivities/prisma.js';
import { currentCompanyId } from '../_core_app_connectivities/tenant-context.js';
import { AppError } from '../classes/app-error.js';
import { blankToNull, blankToUndefined, createCrudRepository, withDates } from '../data_repositories/crud.repository.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { buildLocalizedWriteData } from '../utils/language.js';
import { FILE_SELECT, filePath, filesService, FilePurpose, toFileInfo } from './files.service.js';
import { filter } from '../utils/pagination.js';
import { createWithSequence } from '../utils/sequence.js';

const HR_ERRORS = {
  notFound: ErrorCode.HR_NOT_FOUND,
  inUse: ErrorCode.HR_IN_USE,
  createFailed: ErrorCode.HR_CREATE_FAILED,
  fetchFailed: ErrorCode.HR_FETCH_FAILED,
  updateFailed: ErrorCode.HR_UPDATE_FAILED,
  deleteFailed: ErrorCode.HR_DELETE_FAILED,
};

const EMPLOYEE_NAME = { employee: { select: { name: true } } } as const;
const withEmployeeName = (row: any) => ({ ...row, employeeName: row.employee?.name });
const employeeFilters = { employeeId: filter.id('employeeId'), status: filter.equals('status') };

/** Departments are plain bilingual master data. */
export const departmentsService = createCrudRepository({
  model: 'department',
  errors: HR_ERRORS,
  list: {
    searchFields: ['name', 'nameAr', 'description'],
    sortFields: { id: 'id', name: 'name', status: 'status' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: { status: filter.equals('status') },
  },
  toCreate: (input) => buildLocalizedWriteData(input, true),
  toUpdate: (input) => buildLocalizedWriteData(input, false),
});

export const designationsService = createCrudRepository({
  model: 'designation',
  errors: HR_ERRORS,
  include: { department: { select: { name: true } } },
  list: {
    searchFields: ['name', 'nameAr', 'level', 'department.name'],
    sortFields: { id: 'id', name: 'name', status: 'status', departmentName: 'department.name' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: { status: filter.equals('status'), departmentId: filter.id('departmentId') },
  },
  map: (row) => ({ ...row, departmentName: row.department?.name }),
  toCreate: (input) => buildLocalizedWriteData(input, true),
  toUpdate: (input) => buildLocalizedWriteData(input, false),
});

const employeesRepository = createCrudRepository({
  model: 'employee',
  errors: { ...HR_ERRORS, duplicate: ErrorCode.HR_DUPLICATE },
  include: { department: { select: { name: true } }, designation: { select: { name: true } } },
  list: {
    searchFields: ['name', 'nameAr', 'employeeNumber', 'email', 'phone', 'department.name'],
    sortFields: { id: 'id', name: 'name', employeeNumber: 'employeeNumber', joiningDate: 'joiningDate', employmentStatus: 'employmentStatus' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: {
      departmentId: filter.id('departmentId'),
      designationId: filter.id('designationId'),
      employmentStatus: filter.equals('employmentStatus'),
    },
  },
  map: (row) => ({ ...row, departmentName: row.department?.name, designationName: row.designation?.name }),
  // '' is not a value for the optional unique email or the salary decimal.
  toUpdate: (input) => blankToUndefined(blankToNull(withDates(buildLocalizedWriteData(input, false), ['joiningDate']), ['email']), ['salary']),
});

const EMPLOYEE_INCLUDE = { department: { select: { name: true } }, designation: { select: { name: true } } } as const;
const mapEmployee = (row: any) => ({ ...row, departmentName: row.department?.name, designationName: row.designation?.name });

/**
 * What someone who may handle leave but not HR records sees of an
 * employee: enough to pick one on a leave request, nothing personal
 * (no salary, contact details or ID number).
 */
export function employeePickerView(row: Record<string, any>) {
  return { id: row.id, employeeNumber: row.employeeNumber, name: row.name, nameAr: row.nameAr, employmentStatus: row.employmentStatus, departmentId: row.departmentId, departmentName: row.departmentName };
}

export const employeesService = {
  ...employeesRepository,

  /** The employee list for the leave-request form, for callers without HR access: names only. */
  async listForPicker(query: Parameters<typeof employeesRepository.list>[0]) {
    const page = await employeesRepository.list(query);
    return { ...page, items: page.items.map(employeePickerView) };
  },

  async findOneForPicker(id: number) {
    return employeePickerView(await employeesRepository.findOne(id));
  },

  /** Employee numbers (EMP-00012) are assigned here, one running sequence per company. */
  async create(input: Record<string, unknown>) {
    const data = blankToUndefined(withDates(buildLocalizedWriteData(input, true), ['joiningDate']), ['email', 'salary']) as Record<string, any>;
    try {
      const row = await createWithSequence(
        async () => (await prisma.employee.findFirst({ orderBy: { id: 'desc' }, select: { employeeNumber: true } }))?.employeeNumber,
        (n) => `EMP-${String(n).padStart(5, '0')}`,
        (employeeNumber) =>
          prisma.employee.create({
            data: {
              ...data,
              employeeNumber,
              employmentType: data.employmentType || 'FULL_TIME',
              employmentStatus: data.employmentStatus || 'ACTIVE',
              companyId: currentCompanyId(),
            } as any,
            include: EMPLOYEE_INCLUDE,
          }),
      );
      return mapEmployee(row);
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') throw AppError.from(ErrorCode.HR_DUPLICATE, 409, error);
      throw AppError.from(ErrorCode.HR_CREATE_FAILED, 500, error);
    }
  },
};

const HOUR_MS = 60 * 60 * 1000;

/**
 * Check-in / check-out rules for one attendance row, given the request's
 * date columns and (on update) the stored row: when both times are known,
 * check-out must follow check-in within 24 hours (a night shift ends the
 * next day). hoursWorked is worked out from the two times whenever the
 * request sets a time and does not give hoursWorked itself — a value
 * typed by hand always wins.
 */
export function withAttendanceHours(data: Record<string, any>, existing?: { checkIn?: Date | null; checkOut?: Date | null }): Record<string, any> {
  const checkIn: Date | null = data.checkIn !== undefined ? data.checkIn : (existing?.checkIn ?? null);
  const checkOut: Date | null = data.checkOut !== undefined ? data.checkOut : (existing?.checkOut ?? null);
  if (!checkIn || !checkOut) return data;
  const worked = checkOut.getTime() - checkIn.getTime();
  if (worked <= 0 || worked > 24 * HOUR_MS) throw AppError.from(ErrorCode.HR_ATTENDANCE_TIMES, 400);
  const timesChanged = data.checkIn !== undefined || data.checkOut !== undefined;
  if (timesChanged && (data.hoursWorked === undefined || data.hoursWorked === '')) return { ...data, hoursWorked: (worked / HOUR_MS).toFixed(2) };
  return data;
}

/** On update, a time sent as '' clears it (null); one not sent stays as it is. */
const clearedTimes = (input: Record<string, unknown>, data: Record<string, any>) => ({
  ...data,
  ...(input.checkIn === '' ? { checkIn: null } : {}),
  ...(input.checkOut === '' ? { checkOut: null } : {}),
});

export const attendanceService = createCrudRepository({
  model: 'attendance',
  errors: { ...HR_ERRORS, duplicate: ErrorCode.HR_ATTENDANCE_DUPLICATE },
  include: EMPLOYEE_NAME,
  list: {
    searchFields: ['employee.name', 'employee.nameAr', 'notes'],
    sortFields: { id: 'id', attendDate: 'attendDate', status: 'status', employeeName: 'employee.name' },
    defaultSort: { field: 'attendDate', order: 'desc' },
    filters: { ...employeeFilters, fromDate: filter.dateFrom('attendDate'), toDate: filter.dateTo('attendDate') },
  },
  map: withEmployeeName,
  toCreate: (input) => blankToUndefined(withAttendanceHours({ ...withDates(input, ['attendDate', 'checkIn', 'checkOut']), status: input.status || 'PRESENT' }), ['hoursWorked']),
  toUpdate: (input, existing) => blankToUndefined(withAttendanceHours(clearedTimes(input, withDates(input, ['attendDate', 'checkIn', 'checkOut'])), existing), ['hoursWorked', 'status']),
});

const leaveRequestsRepository = createCrudRepository({
  model: 'leaveRequest',
  errors: HR_ERRORS,
  include: EMPLOYEE_NAME,
  list: {
    searchFields: ['employee.name', 'employee.nameAr', 'leaveType', 'reason'],
    sortFields: { id: 'id', startDate: 'startDate', endDate: 'endDate', status: 'status', employeeName: 'employee.name' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: { ...employeeFilters, fromDate: filter.dateFrom('startDate'), toDate: filter.dateTo('startDate') },
  },
  map: withEmployeeName,
  toCreate: (input) => ({ ...withDates(input, ['startDate', 'endDate']), status: input.status || 'PENDING' }),
  toUpdate: (input) => blankToUndefined(withDates(input, ['startDate', 'endDate']), ['status', 'leaveType']),
});

/**
 * Leave requests have their own permission module (`leaveRequests`):
 * "add" files an application, "edit" decides it. A new request is
 * PENDING; only a caller who may decide can file one already Approved
 * or Rejected. Changing an existing request's status is an update, which
 * the route already limits to "edit".
 */
export const leaveRequestsService = {
  ...leaveRequestsRepository,

  async create(input: Record<string, unknown>, { canDecide = false }: { canDecide?: boolean } = {}) {
    const status = typeof input.status === 'string' && input.status.trim() !== '' ? input.status.trim() : 'PENDING';
    if (status !== 'PENDING' && !canDecide) throw AppError.from(ErrorCode.HR_LEAVE_DECISION_DENIED, 403);
    return leaveRequestsRepository.create({ ...input, status });
  },
};

// ── Attached files (employee document scans, contract PDFs) ─────────────

/**
 * The file columns a create / update writes for a requested file id:
 * nothing when the request does not touch the file, the new file's
 * columns (after checking it may be attached here), or cleared columns
 * for 0. `columns` names the record's own columns for the file.
 */
async function fileChange(requested: unknown, purpose: FilePurpose, currentId: number | null, columns: (file: Awaited<ReturnType<typeof filesService.claim>> | null) => Record<string, unknown>) {
  if (requested === undefined || requested === null) return {};
  if (requested === 0) return columns(null);
  const file = await filesService.claim(requested as number, purpose, currentId);
  return columns(file);
}

/** Wraps a repository so a replaced, removed or orphaned file is deleted once the change has been saved. */
function releasingFiles<T extends { create: (input: any) => Promise<any>; update: (id: number, input: any) => Promise<any>; remove: (id: number) => Promise<void>; findOne: (id: number) => Promise<any> }>(
  repository: T,
  fileIdOf: (row: any) => number | null | undefined,
): T {
  return {
    ...repository,
    async update(id: number, input: any) {
      const before = fileIdOf(await repository.findOne(id));
      const row = await repository.update(id, input);
      if (before && before !== fileIdOf(row)) await filesService.release(before);
      return row;
    },
    async remove(id: number) {
      const before = fileIdOf(await repository.findOne(id));
      await repository.remove(id);
      await filesService.release(before);
    },
  };
}

const omit = <T extends Record<string, unknown>>(input: T, ...keys: string[]) => Object.fromEntries(Object.entries(input).filter(([key]) => !keys.includes(key)));

const documentFileColumns = (file: { id: number } | null) => ({ fileId: file?.id ?? null, fileUrl: file ? filePath(file.id) : null });

const employeeDocumentsRepository = createCrudRepository({
  model: 'employeeDocument',
  errors: HR_ERRORS,
  include: { ...EMPLOYEE_NAME, file: { select: FILE_SELECT } },
  list: {
    searchFields: ['employee.name', 'employee.nameAr', 'documentType', 'documentNumber'],
    sortFields: { id: 'id', expiryDate: 'expiryDate', documentType: 'documentType', employeeName: 'employee.name' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: { employeeId: filter.id('employeeId'), documentType: filter.equals('documentType') },
  },
  map: (row) => ({ ...withEmployeeName(row), file: toFileInfo(row.file) }),
  toCreate: async (input) => ({ ...withDates(omit(input, 'fileId'), ['issueDate', 'expiryDate']), ...(await fileChange(input.fileId, 'EMPLOYEE_DOCUMENT', null, documentFileColumns)) }),
  toUpdate: async (input, existing: any) => ({
    ...blankToUndefined(withDates(omit(input, 'fileId'), ['issueDate', 'expiryDate']), ['documentType']),
    ...(await fileChange(input.fileId, 'EMPLOYEE_DOCUMENT', existing.fileId ?? null, documentFileColumns)),
  }),
});

/** Employee documents: the scan / PDF is uploaded (POST /files) and attached by fileId. */
export const employeeDocumentsService = releasingFiles(employeeDocumentsRepository, (row) => row?.fileId);

/** A contract's document columns, all set from the upload itself — never from the client. */
const contractFileColumns = (file: { id: number; createdAt: Date; uploadedByName: string } | null) => ({
  documentFileId: file?.id ?? null,
  documentUrl: file ? filePath(file.id) : null,
  documentUploadedAt: file?.createdAt ?? null,
  documentUploadedBy: file?.uploadedByName ?? null,
});

const employmentContractsRepository = createCrudRepository({
  model: 'employmentContract',
  errors: { ...HR_ERRORS, duplicate: ErrorCode.HR_DUPLICATE },
  include: { ...EMPLOYEE_NAME, documentFile: { select: FILE_SELECT } },
  list: {
    searchFields: ['employee.name', 'employee.nameAr', 'contractNumber', 'title'],
    sortFields: { id: 'id', startDate: 'startDate', endDate: 'endDate', status: 'status', employeeName: 'employee.name' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: employeeFilters,
  },
  map: (row) => ({ ...withEmployeeName(row), documentFile: toFileInfo(row.documentFile) }),
  toCreate: async (input) => ({
    ...blankToUndefined(withDates(omit(input, 'documentFileId'), ['startDate', 'endDate']), ['salary']),
    contractType: input.contractType || 'FIXED_TERM',
    status: input.status || 'ACTIVE',
    ...(await fileChange(input.documentFileId, 'CONTRACT_DOCUMENT', null, contractFileColumns)),
  }),
  toUpdate: async (input, existing: any) => ({
    ...blankToUndefined(withDates(omit(input, 'documentFileId'), ['startDate', 'endDate']), ['salary', 'status', 'contractType']),
    ...(await fileChange(input.documentFileId, 'CONTRACT_DOCUMENT', existing.documentFileId ?? null, contractFileColumns)),
  }),
});

/** Employment contracts: the signed contract is uploaded (POST /files) and attached by documentFileId. */
export const employmentContractsService = releasingFiles(employmentContractsRepository, (row) => row?.documentFileId);
