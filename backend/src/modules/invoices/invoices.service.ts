import crypto from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { buildZatcaQrTlv } from './zatca-qr.js';

function fail(code: { code: string; filter: any; description: string }, statusCode: number, cause?: unknown): never {
  throw new AppError({ errorCode: code.code, errorFilter: code.filter, errorDescription: code.description, statusCode, cause: cause as Error });
}

const INVOICE_INCLUDE = { customer: { select: { name: true } }, lineItems: true } as const;

function mapOut(row: any) {
  return { ...row, customerName: row.customer?.name };
}

async function generateInvoiceNumber(): Promise<string> {
  const count = await prisma.invoice.count();
  return `INV-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
}

interface LineItemInput {
  description: string;
  quantity: string;
  rate: string;
  taxCategory?: string;
  taxPercent?: string;
}

function computeLineItems(items: LineItemInput[], vatEnabled: boolean, defaultVatPercent: number) {
  let subtotal = 0;
  let vatAmount = 0;
  const rows = items.map((item) => {
    const quantity = Number(item.quantity);
    const rate = Number(item.rate);
    const amount = quantity * rate;
    const taxPercent = item.taxPercent !== undefined ? Number(item.taxPercent) : vatEnabled ? defaultVatPercent : 0;
    const taxAmount = vatEnabled ? (amount * taxPercent) / 100 : 0;
    subtotal += amount;
    vatAmount += taxAmount;
    return {
      description: item.description,
      quantity,
      rate,
      amount,
      taxCategory: item.taxCategory ?? 'S',
      taxPercent,
      taxAmount,
    };
  });
  return { rows, subtotal, vatAmount, total: subtotal + vatAmount };
}

interface CreateInvoiceDto {
  customerId: number;
  dueDate: string;
  fromDate: string;
  toDate: string;
  currency?: string;
  invoiceType?: string;
  paymentMeans?: string;
  vatEnabled?: boolean;
  vatPercent?: string;
  lineItems?: LineItemInput[];
}

/**
 * Direct port of the legacy InvoicesService for the CRUD + totals part.
 * ZATCA integration (see zatca-qr.ts) is the real Phase-1 QR only; Phase-2
 * cryptographic invoice signing against ZATCA's live API needs government-
 * issued certificates this environment can't obtain, so `submitToZatca`
 * generates the QR and flips status without calling out to ZATCA.
 */
export const invoicesService = {
  async findAll() {
    const rows = await prisma.invoice.findMany({ include: INVOICE_INCLUDE, orderBy: { id: 'desc' } });
    return rows.map(mapOut);
  },

  async findOne(id: number) {
    const row = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (!row) fail(ErrorCode.INV_NOT_FOUND, 404);
    return mapOut(row);
  },

  async create(dto: CreateInvoiceDto) {
    try {
      const invoiceNumber = await generateInvoiceNumber();
      const vatEnabled = dto.vatEnabled ?? true;
      const vatPercent = dto.vatPercent ? Number(dto.vatPercent) : 15;
      const { rows, subtotal, vatAmount, total } = computeLineItems(dto.lineItems ?? [], vatEnabled, vatPercent);

      const row = await prisma.invoice.create({
        data: {
          invoiceNumber,
          customerId: dto.customerId,
          dueDate: new Date(dto.dueDate),
          fromDate: new Date(dto.fromDate),
          toDate: new Date(dto.toDate),
          currency: dto.currency ?? 'SAR',
          invoiceType: dto.invoiceType ?? 'STANDARD',
          paymentMeans: dto.paymentMeans ?? 'CASH',
          vatEnabled,
          vatPercent,
          subtotal,
          vatAmount,
          total,
          status: 'UNPAID',
          zatcaStatus: 'PENDING_SIGN',
          lineItems: { create: rows },
        },
        include: INVOICE_INCLUDE,
      });
      return mapOut(row);
    } catch (error) {
      fail(ErrorCode.INV_CREATE_FAILED, 500, error);
    }
  },

  async update(id: number, dto: Partial<CreateInvoiceDto> & { status?: string }) {
    const existing = await this.findOne(id);
    try {
      const data: Record<string, unknown> = {
        customerId: dto.customerId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        fromDate: dto.fromDate ? new Date(dto.fromDate) : undefined,
        toDate: dto.toDate ? new Date(dto.toDate) : undefined,
        currency: dto.currency,
        invoiceType: dto.invoiceType,
        paymentMeans: dto.paymentMeans,
        status: dto.status,
      };

      if (dto.lineItems) {
        const vatEnabled = dto.vatEnabled ?? existing.vatEnabled;
        const vatPercent = dto.vatPercent ? Number(dto.vatPercent) : Number(existing.vatPercent);
        const { rows, subtotal, vatAmount, total } = computeLineItems(dto.lineItems, vatEnabled, vatPercent);
        data.vatEnabled = vatEnabled;
        data.vatPercent = vatPercent;
        data.subtotal = subtotal;
        data.vatAmount = vatAmount;
        data.total = total;
        await prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
        data.lineItems = { create: rows };
      }

      const row = await prisma.invoice.update({ where: { id }, data, include: INVOICE_INCLUDE });
      return mapOut(row);
    } catch (error) {
      fail(ErrorCode.INV_UPDATE_FAILED, 500, error);
    }
  },

  async remove(id: number) {
    await this.findOne(id);
    try {
      await prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
      await prisma.invoice.delete({ where: { id } });
    } catch (error) {
      fail(ErrorCode.INV_DELETE_FAILED, 500, error);
    }
  },

  async markPaid(id: number) {
    const existing = await this.findOne(id);
    if (existing.status === 'PAID') fail(ErrorCode.INV_STATUS_CONFLICT, 400);
    try {
      const row = await prisma.invoice.update({ where: { id }, data: { status: 'PAID', paidAt: new Date() }, include: INVOICE_INCLUDE });
      return mapOut(row);
    } catch (error) {
      fail(ErrorCode.INV_UPDATE_FAILED, 500, error);
    }
  },

  async submitToZatca(id: number) {
    const existing = await this.findOne(id);
    if (existing.zatcaStatus && existing.zatcaStatus !== 'PENDING_SIGN' && existing.zatcaStatus !== 'FAILED') {
      fail(ErrorCode.ZATCA_ALREADY_SUBMITTED, 400);
    }
    try {
      const settings = await prisma.companySettings.findFirst();
      const invoiceUuid = crypto.randomUUID();
      const qrCode = buildZatcaQrTlv({
        sellerName: settings?.companyName ?? 'FleetFlow',
        vatNumber: settings?.vatNumber ?? '',
        timestampIso: new Date().toISOString(),
        totalWithVat: existing.total.toString(),
        vatAmount: existing.vatAmount.toString(),
      });
      const invoiceHash = crypto
        .createHash('sha256')
        .update(`${existing.invoiceNumber}|${existing.total}|${invoiceUuid}`)
        .digest('base64');

      const row = await prisma.invoice.update({
        where: { id },
        data: {
          invoiceUuid,
          qrCode,
          invoiceHash,
          zatcaStatus: 'SIGNED',
          zatcaSubmittedAt: new Date(),
        },
        include: INVOICE_INCLUDE,
      });
      return mapOut(row);
    } catch (error) {
      fail(ErrorCode.ZATCA_SUBMIT_FAILED, 500, error);
    }
  },
};
