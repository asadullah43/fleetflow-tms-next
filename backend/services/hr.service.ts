import { prisma } from '../_core_app_connectivities/prisma.js';
import { currentCompanyId } from '../_core_app_connectivities/tenant-context.js';
import { AppError } from '../classes/app-error.js';
import { blankToUndefined, createCrudRepository, withDates } from '../data_repositories/crud.repository.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { buildLocalizedWriteData } from '../utils/language.js';
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
  toUpdate: (input) => blankToUndefined(withDates(buildLocalizedWriteData(input, false), ['joiningDate']), ['email', 'salary']),
});

const EMPLOYEE_INCLUDE = { department: { select: { name: true } }, designation: { select: { name: true } } } as const;
const mapEmployee = (row: any) => ({ ...row, departmentName: row.department?.name, designationName: row.designation?.name });

export const employeesService = {
  ...employeesRepository,

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
  toCreate: (input) => ({ ...blankToUndefined(withDates(input, ['attendDate', 'checkIn', 'checkOut']), ['hoursWorked']), status: input.status || 'PRESENT' }),
  toUpdate: (input) => blankToUndefined(withDates(input, ['attendDate', 'checkIn', 'checkOut']), ['hoursWorked', 'status']),
});

export const leaveRequestsService = createCrudRepository({
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

export const employeeDocumentsService = createCrudRepository({
  model: 'employeeDocument',
  errors: HR_ERRORS,
  include: EMPLOYEE_NAME,
  list: {
    searchFields: ['employee.name', 'employee.nameAr', 'documentType', 'documentNumber'],
    sortFields: { id: 'id', expiryDate: 'expiryDate', documentType: 'documentType', employeeName: 'employee.name' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: { employeeId: filter.id('employeeId'), documentType: filter.equals('documentType') },
  },
  map: withEmployeeName,
  toCreate: (input) => withDates(input, ['issueDate', 'expiryDate']),
  toUpdate: (input) => blankToUndefined(withDates(input, ['issueDate', 'expiryDate']), ['documentType']),
});

export const employmentContractsService = createCrudRepository({
  model: 'employmentContract',
  errors: { ...HR_ERRORS, duplicate: ErrorCode.HR_DUPLICATE },
  include: EMPLOYEE_NAME,
  list: {
    searchFields: ['employee.name', 'employee.nameAr', 'contractNumber', 'title'],
    sortFields: { id: 'id', startDate: 'startDate', endDate: 'endDate', status: 'status', employeeName: 'employee.name' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: employeeFilters,
  },
  map: withEmployeeName,
  toCreate: (input) => ({
    ...blankToUndefined(withDates(input, ['startDate', 'endDate']), ['salary']),
    contractType: input.contractType || 'FIXED_TERM',
    status: input.status || 'ACTIVE',
  }),
  toUpdate: (input) => blankToUndefined(withDates(input, ['startDate', 'endDate']), ['salary', 'status', 'contractType']),
});
