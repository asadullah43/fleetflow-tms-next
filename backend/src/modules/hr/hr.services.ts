import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { createCrudService } from '../../common/crud/crud.service.js';

function fail(code: { code: string; filter: any; description: string }, statusCode: number, cause?: unknown): never {
  throw new AppError({ errorCode: code.code, errorFilter: code.filter, errorDescription: code.description, statusCode, cause: cause as Error });
}

const HR_ERRORS = {
  notFound: ErrorCode.HR_NOT_FOUND,
  inUse: ErrorCode.HR_IN_USE,
  createFailed: ErrorCode.HR_CREATE_FAILED,
  fetchFailed: ErrorCode.HR_FETCH_FAILED,
  updateFailed: ErrorCode.HR_UPDATE_FAILED,
  deleteFailed: ErrorCode.HR_DELETE_FAILED,
};

/** Departments and Designations are plain bilingual master data. */
export const departmentsService = createCrudService('department', HR_ERRORS);

const designationDelegate = () => prisma.designation;

export const designationsService = {
  async findAll() {
    const rows = await designationDelegate().findMany({ include: { department: { select: { name: true } } }, orderBy: { id: 'desc' } });
    return rows.map((r: any) => ({ ...r, departmentName: r.department?.name }));
  },
  async findOne(id: number) {
    const row = await designationDelegate().findUnique({ where: { id }, include: { department: { select: { name: true } } } });
    if (!row) fail(ErrorCode.HR_NOT_FOUND, 404);
    return { ...row, departmentName: (row as any).department?.name };
  },
  async create(dto: Record<string, unknown>) {
    const { buildLocalizedWriteData } = await import('../../common/localization/language.util.js');
    try {
      return await designationDelegate().create({ data: buildLocalizedWriteData(dto, true) as any });
    } catch (error) {
      fail(ErrorCode.HR_CREATE_FAILED, 500, error);
    }
  },
  async update(id: number, dto: Record<string, unknown>) {
    const { buildLocalizedWriteData } = await import('../../common/localization/language.util.js');
    await this.findOne(id);
    try {
      return await designationDelegate().update({ where: { id }, data: buildLocalizedWriteData(dto, false) as any });
    } catch (error) {
      fail(ErrorCode.HR_UPDATE_FAILED, 500, error);
    }
  },
  async remove(id: number) {
    await this.findOne(id);
    try {
      await designationDelegate().delete({ where: { id } });
    } catch (error) {
      fail(ErrorCode.HR_DELETE_FAILED, 500, error);
    }
  },
};

async function generateEmployeeNumber(): Promise<string> {
  const count = await prisma.employee.count();
  return `EMP-${String(count + 1).padStart(5, '0')}`;
}

const EMPLOYEE_INCLUDE = { department: { select: { name: true } }, designation: { select: { name: true } } } as const;
function mapEmployee(row: any) {
  return { ...row, departmentName: row.department?.name, designationName: row.designation?.name };
}

export const employeesService = {
  async findAll() {
    const rows = await prisma.employee.findMany({ include: EMPLOYEE_INCLUDE, orderBy: { id: 'desc' } });
    return rows.map(mapEmployee);
  },
  async findOne(id: number) {
    const row = await prisma.employee.findUnique({ where: { id }, include: EMPLOYEE_INCLUDE });
    if (!row) fail(ErrorCode.HR_NOT_FOUND, 404);
    return mapEmployee(row);
  },
  async create(dto: Record<string, any>) {
    const { buildLocalizedWriteData } = await import('../../common/localization/language.util.js');
    try {
      const employeeNumber = await generateEmployeeNumber();
      const data = buildLocalizedWriteData(dto, true) as Record<string, any>;
      const row = await prisma.employee.create({
        data: {
          employeeNumber,
          name: data.name,
          nameAr: data.nameAr,
          email: data.email || undefined,
          phone: data.phone,
          idNumber: data.idNumber,
          joiningDate: new Date(data.joiningDate),
          employmentType: data.employmentType ?? 'FULL_TIME',
          employmentStatus: data.employmentStatus ?? 'ACTIVE',
          departmentId: data.departmentId,
          designationId: data.designationId,
          managerId: data.managerId,
          salary: data.salary,
          address: data.address,
          emergencyContact: data.emergencyContact,
          emergencyPhone: data.emergencyPhone,
          driverId: data.driverId,
          notes: data.notes,
        },
        include: EMPLOYEE_INCLUDE,
      });
      return mapEmployee(row);
    } catch (error) {
      fail(ErrorCode.HR_CREATE_FAILED, 500, error);
    }
  },
  async update(id: number, dto: Record<string, any>) {
    const { buildLocalizedWriteData } = await import('../../common/localization/language.util.js');
    await this.findOne(id);
    try {
      const data = buildLocalizedWriteData(dto, false) as Record<string, any>;
      const row = await prisma.employee.update({
        where: { id },
        data: {
          ...data,
          joiningDate: data.joiningDate ? new Date(data.joiningDate) : undefined,
        },
        include: EMPLOYEE_INCLUDE,
      });
      return mapEmployee(row);
    } catch (error) {
      fail(ErrorCode.HR_UPDATE_FAILED, 500, error);
    }
  },
  async remove(id: number) {
    await this.findOne(id);
    try {
      await prisma.employee.delete({ where: { id } });
    } catch (error) {
      fail(ErrorCode.HR_DELETE_FAILED, 500, error);
    }
  },
};

const ATTENDANCE_INCLUDE = { employee: { select: { name: true } } } as const;
export const attendanceService = {
  async findAll() {
    const rows = await prisma.attendance.findMany({ include: ATTENDANCE_INCLUDE, orderBy: { id: 'desc' } });
    return rows.map((r: any) => ({ ...r, employeeName: r.employee?.name }));
  },
  async findOne(id: number) {
    const row = await prisma.attendance.findUnique({ where: { id }, include: ATTENDANCE_INCLUDE });
    if (!row) fail(ErrorCode.HR_NOT_FOUND, 404);
    return { ...row, employeeName: (row as any).employee?.name };
  },
  async create(dto: Record<string, any>) {
    try {
      const row = await prisma.attendance.create({
        data: {
          employeeId: dto.employeeId,
          attendDate: new Date(dto.attendDate),
          checkIn: dto.checkIn ? new Date(dto.checkIn) : undefined,
          checkOut: dto.checkOut ? new Date(dto.checkOut) : undefined,
          status: dto.status ?? 'PRESENT',
          hoursWorked: dto.hoursWorked,
          notes: dto.notes,
        },
        include: ATTENDANCE_INCLUDE,
      });
      return { ...row, employeeName: (row as any).employee?.name };
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') fail(ErrorCode.HR_ATTENDANCE_DUPLICATE, 400, error);
      fail(ErrorCode.HR_CREATE_FAILED, 500, error);
    }
  },
  async update(id: number, dto: Record<string, any>) {
    await this.findOne(id);
    try {
      const row = await prisma.attendance.update({
        where: { id },
        data: {
          ...dto,
          attendDate: dto.attendDate ? new Date(dto.attendDate) : undefined,
          checkIn: dto.checkIn ? new Date(dto.checkIn) : undefined,
          checkOut: dto.checkOut ? new Date(dto.checkOut) : undefined,
        },
        include: ATTENDANCE_INCLUDE,
      });
      return { ...row, employeeName: (row as any).employee?.name };
    } catch (error) {
      fail(ErrorCode.HR_UPDATE_FAILED, 500, error);
    }
  },
  async remove(id: number) {
    await this.findOne(id);
    try {
      await prisma.attendance.delete({ where: { id } });
    } catch (error) {
      fail(ErrorCode.HR_DELETE_FAILED, 500, error);
    }
  },
};

const LEAVE_INCLUDE = { employee: { select: { name: true } } } as const;
export const leaveRequestsService = {
  async findAll() {
    const rows = await prisma.leaveRequest.findMany({ include: LEAVE_INCLUDE, orderBy: { id: 'desc' } });
    return rows.map((r: any) => ({ ...r, employeeName: r.employee?.name }));
  },
  async findOne(id: number) {
    const row = await prisma.leaveRequest.findUnique({ where: { id }, include: LEAVE_INCLUDE });
    if (!row) fail(ErrorCode.HR_NOT_FOUND, 404);
    return { ...row, employeeName: (row as any).employee?.name };
  },
  async create(dto: Record<string, any>) {
    try {
      const row = await prisma.leaveRequest.create({
        data: {
          employeeId: dto.employeeId,
          leaveType: dto.leaveType,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          days: dto.days,
          reason: dto.reason,
          status: dto.status ?? 'PENDING',
        },
        include: LEAVE_INCLUDE,
      });
      return { ...row, employeeName: (row as any).employee?.name };
    } catch (error) {
      fail(ErrorCode.HR_CREATE_FAILED, 500, error);
    }
  },
  async update(id: number, dto: Record<string, any>) {
    await this.findOne(id);
    try {
      const row = await prisma.leaveRequest.update({
        where: { id },
        data: {
          ...dto,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        },
        include: LEAVE_INCLUDE,
      });
      return { ...row, employeeName: (row as any).employee?.name };
    } catch (error) {
      fail(ErrorCode.HR_UPDATE_FAILED, 500, error);
    }
  },
  async remove(id: number) {
    await this.findOne(id);
    try {
      await prisma.leaveRequest.delete({ where: { id } });
    } catch (error) {
      fail(ErrorCode.HR_DELETE_FAILED, 500, error);
    }
  },
};

const DOC_INCLUDE = { employee: { select: { name: true } } } as const;
export const employeeDocumentsService = {
  async findAll() {
    const rows = await prisma.employeeDocument.findMany({ include: DOC_INCLUDE, orderBy: { id: 'desc' } });
    return rows.map((r: any) => ({ ...r, employeeName: r.employee?.name }));
  },
  async findOne(id: number) {
    const row = await prisma.employeeDocument.findUnique({ where: { id }, include: DOC_INCLUDE });
    if (!row) fail(ErrorCode.HR_NOT_FOUND, 404);
    return { ...row, employeeName: (row as any).employee?.name };
  },
  async create(dto: Record<string, any>) {
    try {
      const row = await prisma.employeeDocument.create({
        data: {
          employeeId: dto.employeeId,
          documentType: dto.documentType,
          documentNumber: dto.documentNumber,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
          fileUrl: dto.fileUrl,
          notes: dto.notes,
        },
        include: DOC_INCLUDE,
      });
      return { ...row, employeeName: (row as any).employee?.name };
    } catch (error) {
      fail(ErrorCode.HR_CREATE_FAILED, 500, error);
    }
  },
  async update(id: number, dto: Record<string, any>) {
    await this.findOne(id);
    try {
      const row = await prisma.employeeDocument.update({
        where: { id },
        data: {
          ...dto,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        },
        include: DOC_INCLUDE,
      });
      return { ...row, employeeName: (row as any).employee?.name };
    } catch (error) {
      fail(ErrorCode.HR_UPDATE_FAILED, 500, error);
    }
  },
  async remove(id: number) {
    await this.findOne(id);
    try {
      await prisma.employeeDocument.delete({ where: { id } });
    } catch (error) {
      fail(ErrorCode.HR_DELETE_FAILED, 500, error);
    }
  },
};

const CONTRACT_INCLUDE = { employee: { select: { name: true } } } as const;
export const employmentContractsService = {
  async findAll() {
    const rows = await prisma.employmentContract.findMany({ include: CONTRACT_INCLUDE, orderBy: { id: 'desc' } });
    return rows.map((r: any) => ({ ...r, employeeName: r.employee?.name }));
  },
  async findOne(id: number) {
    const row = await prisma.employmentContract.findUnique({ where: { id }, include: CONTRACT_INCLUDE });
    if (!row) fail(ErrorCode.HR_NOT_FOUND, 404);
    return { ...row, employeeName: (row as any).employee?.name };
  },
  async create(dto: Record<string, any>) {
    try {
      const row = await prisma.employmentContract.create({
        data: {
          employeeId: dto.employeeId,
          contractNumber: dto.contractNumber,
          contractType: dto.contractType ?? 'FIXED_TERM',
          startDate: new Date(dto.startDate),
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          salary: dto.salary,
          currency: dto.currency,
          terms: dto.terms,
          status: dto.status ?? 'ACTIVE',
          documentUrl: dto.documentUrl,
          title: dto.title,
          notes: dto.notes,
        },
        include: CONTRACT_INCLUDE,
      });
      return { ...row, employeeName: (row as any).employee?.name };
    } catch (error) {
      fail(ErrorCode.HR_CREATE_FAILED, 500, error);
    }
  },
  async update(id: number, dto: Record<string, any>) {
    await this.findOne(id);
    try {
      const row = await prisma.employmentContract.update({
        where: { id },
        data: {
          ...dto,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        },
        include: CONTRACT_INCLUDE,
      });
      return { ...row, employeeName: (row as any).employee?.name };
    } catch (error) {
      fail(ErrorCode.HR_UPDATE_FAILED, 500, error);
    }
  },
  async remove(id: number) {
    await this.findOne(id);
    try {
      await prisma.employmentContract.delete({ where: { id } });
    } catch (error) {
      fail(ErrorCode.HR_DELETE_FAILED, 500, error);
    }
  },
};
