import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

const INCLUDE = { supplier: { select: { name: true, nameAr: true } } } as const;

function mapOut(row: any) {
  return {
    id: row.id,
    supplierId: row.supplierId,
    amount: row.amount,
    currency: row.currency,
    paymentDate: row.paymentDate,
    description: row.description,
    supplierName: row.supplier?.name,
    supplierNameAr: row.supplier?.nameAr,
  };
}

function fail(code: { code: string; filter: any; description: string }, statusCode: number, cause?: unknown): never {
  throw new AppError({ errorCode: code.code, errorFilter: code.filter, errorDescription: code.description, statusCode, cause: cause as Error });
}

interface SupplierPaymentDto {
  supplierId: number;
  amount: string;
  currency?: string;
  paymentDate?: string;
  description?: string;
}

/** Direct port of the legacy SupplierPaymentsService. */
export const supplierPaymentsService = {
  async findAll() {
    const rows = await prisma.supplierPayment.findMany({ include: INCLUDE, orderBy: { id: 'desc' } });
    return rows.map(mapOut);
  },

  async findOne(id: number) {
    const row = await prisma.supplierPayment.findUnique({ where: { id }, include: INCLUDE });
    if (!row) fail(ErrorCode.SPP_NOT_FOUND, 404);
    return mapOut(row);
  },

  async create(dto: Partial<SupplierPaymentDto>) {
    try {
      const row = await prisma.supplierPayment.create({
        data: {
          supplierId: dto.supplierId!,
          amount: dto.amount!,
          currency: dto.currency ?? 'SAR',
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          description: dto.description,
        },
        include: INCLUDE,
      });
      return mapOut(row);
    } catch (error) {
      fail(ErrorCode.SPP_CREATE_FAILED, 500, error);
    }
  },

  async update(id: number, dto: Partial<SupplierPaymentDto>) {
    await this.findOne(id);
    try {
      const row = await prisma.supplierPayment.update({
        where: { id },
        data: {
          supplierId: dto.supplierId,
          amount: dto.amount,
          currency: dto.currency,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : undefined,
          description: dto.description,
        },
        include: INCLUDE,
      });
      return mapOut(row);
    } catch (error) {
      fail(ErrorCode.SPP_UPDATE_FAILED, 500, error);
    }
  },

  async remove(id: number) {
    await this.findOne(id);
    try {
      await prisma.supplierPayment.delete({ where: { id } });
    } catch (error) {
      fail(ErrorCode.SPP_DELETE_FAILED, 500, error);
    }
  },
};
