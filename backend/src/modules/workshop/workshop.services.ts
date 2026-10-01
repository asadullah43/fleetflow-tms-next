import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

function fail(code: { code: string; filter: any; description: string }, statusCode: number, cause?: unknown): never {
  throw new AppError({ errorCode: code.code, errorFilter: code.filter, errorDescription: code.description, statusCode, cause: cause as Error });
}

async function generateOrderNumber(): Promise<string> {
  const count = await prisma.workOrder.count();
  return `WO-${String(count + 1).padStart(5, '0')}`;
}

const WO_INCLUDE = { truck: { select: { truckNumber: true } }, driver: { select: { name: true, nameAr: true } } } as const;
function mapWorkOrder(row: any) {
  return { ...row, truckNumber: row.truck?.truckNumber, driverName: row.driver?.name, driverNameAr: row.driver?.nameAr };
}

export const workOrdersService = {
  async findAll() {
    const rows = await prisma.workOrder.findMany({ include: WO_INCLUDE, orderBy: { id: 'desc' } });
    return rows.map(mapWorkOrder);
  },
  async findOne(id: number) {
    const row = await prisma.workOrder.findUnique({ where: { id }, include: WO_INCLUDE });
    if (!row) fail(ErrorCode.WKS_NOT_FOUND, 404);
    return mapWorkOrder(row);
  },
  async create(dto: Record<string, any>) {
    try {
      const orderNumber = await generateOrderNumber();
      const laborCost = Number(dto.laborCost ?? 0);
      const partsCost = Number(dto.partsCost ?? 0);
      const otherCost = Number(dto.otherCost ?? 0);
      const row = await prisma.workOrder.create({
        data: {
          orderNumber,
          truckId: dto.truckId,
          driverId: dto.driverId,
          supplierId: dto.supplierId,
          issue: dto.issue,
          diagnosis: dto.diagnosis,
          description: dto.description,
          priority: dto.priority ?? 'MEDIUM',
          status: dto.status ?? 'OPEN',
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          completionDate: dto.completionDate ? new Date(dto.completionDate) : undefined,
          odometer: dto.odometer,
          laborCost,
          partsCost,
          otherCost,
          totalCost: laborCost + partsCost + otherCost,
          notes: dto.notes,
        },
        include: WO_INCLUDE,
      });
      return mapWorkOrder(row);
    } catch (error) {
      fail(ErrorCode.WKS_CREATE_FAILED, 500, error);
    }
  },
  async update(id: number, dto: Record<string, any>) {
    const existing = await this.findOne(id);
    try {
      const laborCost = dto.laborCost !== undefined ? Number(dto.laborCost) : Number(existing.laborCost);
      const partsCost = dto.partsCost !== undefined ? Number(dto.partsCost) : Number(existing.partsCost);
      const otherCost = dto.otherCost !== undefined ? Number(dto.otherCost) : Number(existing.otherCost);
      const row = await prisma.workOrder.update({
        where: { id },
        data: {
          ...dto,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          completionDate: dto.completionDate ? new Date(dto.completionDate) : undefined,
          laborCost,
          partsCost,
          otherCost,
          totalCost: laborCost + partsCost + otherCost,
        },
        include: WO_INCLUDE,
      });
      return mapWorkOrder(row);
    } catch (error) {
      fail(ErrorCode.WKS_UPDATE_FAILED, 500, error);
    }
  },
  async remove(id: number) {
    await this.findOne(id);
    try {
      await prisma.workOrder.delete({ where: { id } });
    } catch (error) {
      fail(ErrorCode.WKS_DELETE_FAILED, 500, error);
    }
  },
};

const MNT_INCLUDE = { truck: { select: { truckNumber: true } } } as const;
export const maintenanceSchedulesService = {
  async findAll() {
    const rows = await prisma.maintenanceSchedule.findMany({ include: MNT_INCLUDE, orderBy: { id: 'desc' } });
    return rows.map((r: any) => ({ ...r, truckNumber: r.truck?.truckNumber }));
  },
  async findOne(id: number) {
    const row = await prisma.maintenanceSchedule.findUnique({ where: { id }, include: MNT_INCLUDE });
    if (!row) fail(ErrorCode.WKS_MNT_NOT_FOUND, 404);
    return { ...row, truckNumber: (row as any).truck?.truckNumber };
  },
  async create(dto: Record<string, any>) {
    try {
      const row = await prisma.maintenanceSchedule.create({
        data: {
          truckId: dto.truckId,
          maintenanceType: dto.maintenanceType,
          description: dto.description,
          mileageInterval: dto.mileageInterval,
          dayInterval: dto.dayInterval,
          lastService: dto.lastService ? new Date(dto.lastService) : undefined,
          nextService: dto.nextService ? new Date(dto.nextService) : undefined,
          status: dto.status ?? 'ACTIVE',
          notes: dto.notes,
        },
        include: MNT_INCLUDE,
      });
      return { ...row, truckNumber: (row as any).truck?.truckNumber };
    } catch (error) {
      fail(ErrorCode.WKS_MNT_CREATE_FAILED, 500, error);
    }
  },
  async update(id: number, dto: Record<string, any>) {
    await this.findOne(id);
    try {
      const row = await prisma.maintenanceSchedule.update({
        where: { id },
        data: {
          ...dto,
          lastService: dto.lastService ? new Date(dto.lastService) : undefined,
          nextService: dto.nextService ? new Date(dto.nextService) : undefined,
        },
        include: MNT_INCLUDE,
      });
      return { ...row, truckNumber: (row as any).truck?.truckNumber };
    } catch (error) {
      fail(ErrorCode.WKS_MNT_UPDATE_FAILED, 500, error);
    }
  },
  async remove(id: number) {
    await this.findOne(id);
    try {
      await prisma.maintenanceSchedule.delete({ where: { id } });
    } catch (error) {
      fail(ErrorCode.WKS_MNT_DELETE_FAILED, 500, error);
    }
  },
};

const INSPECTION_INCLUDE = { truck: { select: { truckNumber: true } }, inspector: { select: { name: true } } } as const;
export const vehicleInspectionsService = {
  async findAll() {
    const rows = await prisma.vehicleInspection.findMany({ include: INSPECTION_INCLUDE, orderBy: { id: 'desc' } });
    return rows.map((r: any) => ({ ...r, truckNumber: r.truck?.truckNumber, inspectorName: r.inspector?.name }));
  },
  async findOne(id: number) {
    const row = await prisma.vehicleInspection.findUnique({ where: { id }, include: INSPECTION_INCLUDE });
    if (!row) fail(ErrorCode.WKS_INS_NOT_FOUND, 404);
    return { ...row, truckNumber: (row as any).truck?.truckNumber, inspectorName: (row as any).inspector?.name };
  },
  async create(dto: Record<string, any>) {
    try {
      const row = await prisma.vehicleInspection.create({
        data: {
          truckId: dto.truckId,
          inspectorId: dto.inspectorId,
          inspectDate: new Date(dto.inspectDate),
          odometer: dto.odometer,
          notes: dto.notes,
          result: dto.result ?? 'PASS',
          attachments: dto.attachments,
        },
        include: INSPECTION_INCLUDE,
      });
      return { ...row, truckNumber: (row as any).truck?.truckNumber, inspectorName: (row as any).inspector?.name };
    } catch (error) {
      fail(ErrorCode.WKS_INS_CREATE_FAILED, 500, error);
    }
  },
  async update(id: number, dto: Record<string, any>) {
    await this.findOne(id);
    try {
      const row = await prisma.vehicleInspection.update({
        where: { id },
        data: { ...dto, inspectDate: dto.inspectDate ? new Date(dto.inspectDate) : undefined },
        include: INSPECTION_INCLUDE,
      });
      return { ...row, truckNumber: (row as any).truck?.truckNumber, inspectorName: (row as any).inspector?.name };
    } catch (error) {
      fail(ErrorCode.WKS_INS_CREATE_FAILED, 500, error);
    }
  },
  async remove(id: number) {
    await this.findOne(id);
    try {
      await prisma.vehicleInspection.delete({ where: { id } });
    } catch (error) {
      fail(ErrorCode.WKS_INS_DELETE_FAILED, 500, error);
    }
  },
};

const SPARE_INCLUDE = { supplier: { select: { name: true, nameAr: true } } } as const;
export const sparePartsService = {
  async findAll() {
    const rows = await prisma.sparePart.findMany({ include: SPARE_INCLUDE, orderBy: { id: 'desc' } });
    return rows.map((r: any) => ({ ...r, supplierName: r.supplier?.name, supplierNameAr: r.supplier?.nameAr }));
  },
  async findOne(id: number) {
    const row = await prisma.sparePart.findUnique({ where: { id }, include: SPARE_INCLUDE });
    if (!row) fail(ErrorCode.WKS_SPK_NOT_FOUND, 404);
    return { ...row, supplierName: (row as any).supplier?.name, supplierNameAr: (row as any).supplier?.nameAr };
  },
  async create(dto: Record<string, any>) {
    const { buildLocalizedWriteData } = await import('../../common/localization/language.util.js');
    try {
      const data = buildLocalizedWriteData(dto, true) as any;
      const row = await prisma.sparePart.create({ data, include: SPARE_INCLUDE });
      return { ...row, supplierName: (row as any).supplier?.name, supplierNameAr: (row as any).supplier?.nameAr };
    } catch (error) {
      fail(ErrorCode.WKS_SPK_CREATE_FAILED, 500, error);
    }
  },
  async update(id: number, dto: Record<string, any>) {
    const { buildLocalizedWriteData } = await import('../../common/localization/language.util.js');
    await this.findOne(id);
    try {
      const row = await prisma.sparePart.update({ where: { id }, data: buildLocalizedWriteData(dto, false) as any, include: SPARE_INCLUDE });
      return { ...row, supplierName: (row as any).supplier?.name, supplierNameAr: (row as any).supplier?.nameAr };
    } catch (error) {
      fail(ErrorCode.WKS_SPK_UPDATE_FAILED, 500, error);
    }
  },
  async remove(id: number) {
    await this.findOne(id);
    try {
      await prisma.sparePart.delete({ where: { id } });
    } catch (error) {
      fail(ErrorCode.WKS_SPK_DELETE_FAILED, 500, error);
    }
  },
};

const EXPENSE_INCLUDE = { truck: { select: { truckNumber: true } } } as const;
export const workshopExpensesService = {
  async findAll() {
    const rows = await prisma.workshopExpense.findMany({ include: EXPENSE_INCLUDE, orderBy: { id: 'desc' } });
    return rows.map((r: any) => ({ ...r, truckNumber: r.truck?.truckNumber }));
  },
  async findOne(id: number) {
    const row = await prisma.workshopExpense.findUnique({ where: { id }, include: EXPENSE_INCLUDE });
    if (!row) fail(ErrorCode.WKS_NOT_FOUND, 404);
    return { ...row, truckNumber: (row as any).truck?.truckNumber };
  },
  async create(dto: Record<string, any>) {
    try {
      const row = await prisma.workshopExpense.create({
        data: {
          truckId: dto.truckId,
          workOrderId: dto.workOrderId,
          category: dto.category,
          amount: dto.amount,
          description: dto.description,
          expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : new Date(),
        },
        include: EXPENSE_INCLUDE,
      });
      return { ...row, truckNumber: (row as any).truck?.truckNumber };
    } catch (error) {
      fail(ErrorCode.WKS_EXP_CREATE_FAILED, 500, error);
    }
  },
  async update(id: number, dto: Record<string, any>) {
    await this.findOne(id);
    try {
      const row = await prisma.workshopExpense.update({
        where: { id },
        data: { ...dto, expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined },
        include: EXPENSE_INCLUDE,
      });
      return { ...row, truckNumber: (row as any).truck?.truckNumber };
    } catch (error) {
      fail(ErrorCode.WKS_EXP_CREATE_FAILED, 500, error);
    }
  },
  async remove(id: number) {
    await this.findOne(id);
    try {
      await prisma.workshopExpense.delete({ where: { id } });
    } catch (error) {
      fail(ErrorCode.WKS_EXP_CREATE_FAILED, 500, error);
    }
  },
};

// ---- Nested line-item tables: work order parts, inspection items, spare part stock transactions ----

export const workOrderPartsService = {
  async findAll(workOrderId?: number) {
    const rows = await prisma.workOrderPart.findMany({
      where: workOrderId ? { workOrderId } : undefined,
      include: { sparePart: { select: { name: true } } },
      orderBy: { id: 'desc' },
    });
    return rows.map((r: any) => ({ ...r, sparePartName: r.sparePart?.name }));
  },
  async create(dto: { workOrderId: number; sparePartId: number; quantity: number; unitCost: string }) {
    try {
      const totalCost = Number(dto.unitCost) * dto.quantity;
      const [row] = await prisma.$transaction([
        prisma.workOrderPart.create({
          data: { workOrderId: dto.workOrderId, sparePartId: dto.sparePartId, quantity: dto.quantity, unitCost: dto.unitCost, totalCost },
          include: { sparePart: { select: { name: true } } },
        }),
        prisma.sparePart.update({ where: { id: dto.sparePartId }, data: { quantity: { decrement: dto.quantity } } }),
      ]);
      return { ...row, sparePartName: (row as any).sparePart?.name };
    } catch (error) {
      fail(ErrorCode.WKS_CREATE_FAILED, 500, error);
    }
  },
  async update(id: number, dto: { quantity?: number; unitCost?: string }) {
    try {
      const existing = await prisma.workOrderPart.findUnique({ where: { id } });
      if (!existing) fail(ErrorCode.WKS_NOT_FOUND, 404);
      const quantity = dto.quantity ?? existing!.quantity;
      const unitCost = dto.unitCost ?? existing!.unitCost.toString();
      const row = await prisma.workOrderPart.update({
        where: { id },
        data: { quantity, unitCost, totalCost: Number(unitCost) * quantity },
        include: { sparePart: { select: { name: true } } },
      });
      return { ...row, sparePartName: (row as any).sparePart?.name };
    } catch (error) {
      if (error instanceof AppError) throw error;
      fail(ErrorCode.WKS_UPDATE_FAILED, 500, error);
    }
  },
  async remove(id: number) {
    try {
      await prisma.workOrderPart.delete({ where: { id } });
    } catch (error) {
      fail(ErrorCode.WKS_DELETE_FAILED, 500, error);
    }
  },
};

export const inspectionItemsService = {
  async findAll(inspectionId?: number) {
    return prisma.inspectionItem.findMany({ where: inspectionId ? { inspectionId } : undefined, orderBy: { id: 'desc' } });
  },
  async create(dto: { inspectionId: number; workOrderId?: number; checklistItem: string; status?: string; defect?: string }) {
    try {
      return await prisma.inspectionItem.create({
        data: { inspectionId: dto.inspectionId, workOrderId: dto.workOrderId, checklistItem: dto.checklistItem, status: dto.status ?? 'PASS', defect: dto.defect },
      });
    } catch (error) {
      fail(ErrorCode.WKS_INS_CREATE_FAILED, 500, error);
    }
  },
  async update(id: number, dto: { status?: string; defect?: string }) {
    try {
      return await prisma.inspectionItem.update({ where: { id }, data: dto });
    } catch (error) {
      fail(ErrorCode.WKS_INS_CREATE_FAILED, 500, error);
    }
  },
  async remove(id: number) {
    try {
      await prisma.inspectionItem.delete({ where: { id } });
    } catch (error) {
      fail(ErrorCode.WKS_INS_DELETE_FAILED, 500, error);
    }
  },
};

export const sparePartTransactionsService = {
  async findAll(sparePartId?: number) {
    const rows = await prisma.sparePartTransaction.findMany({
      where: sparePartId ? { sparePartId } : undefined,
      include: { sparePart: { select: { name: true } } },
      orderBy: { id: 'desc' },
    });
    return rows.map((r: any) => ({ ...r, sparePartName: r.sparePart?.name }));
  },
  async create(dto: { sparePartId: number; transactionType: string; quantity: number; referenceNote?: string }) {
    try {
      const delta = dto.transactionType === 'OUT' ? -Math.abs(dto.quantity) : Math.abs(dto.quantity);
      const [row] = await prisma.$transaction([
        prisma.sparePartTransaction.create({
          data: { sparePartId: dto.sparePartId, transactionType: dto.transactionType, quantity: dto.quantity, referenceNote: dto.referenceNote },
          include: { sparePart: { select: { name: true } } },
        }),
        prisma.sparePart.update({ where: { id: dto.sparePartId }, data: { quantity: { increment: delta } } }),
      ]);
      return { ...row, sparePartName: (row as any).sparePart?.name };
    } catch (error) {
      fail(ErrorCode.WKS_SPK_TX_CREATE_FAILED, 500, error);
    }
  },
  async remove(id: number) {
    try {
      await prisma.sparePartTransaction.delete({ where: { id } });
    } catch (error) {
      fail(ErrorCode.WKS_SPK_TX_CREATE_FAILED, 500, error);
    }
  },
};
