import crypto from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { fail } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { createWithSequence } from '../../common/sequence.js';
import { buildZatcaQrTlv, zatcaTimestamp } from './zatca-qr.js';
import { computeInvoice, InvoiceInputError, LineItemInput } from './invoice-math.js';

const INVOICE_INCLUDE = { customer: { select: { name: true, nameAr: true } }, lineItems: true } as const;

/** Once ZATCA has a QR/hash for an invoice, its amounts must not change. */
const LOCKED_ZATCA_STATUSES = new Set(['SIGNED', 'REPORTED', 'CLEARED']);

const DEFAULT_VAT_PERCENT = '15';

function mapOut(row: any) {
  return { ...row, customerName: row.customer?.name, customerNameAr: row.customer?.nameAr };
}

/** Parses a required date string; a missing or unparseable value is the caller's error, not a 500. */
function requireDate(value: string | undefined): Date {
  const date = value ? new Date(value) : new Date(NaN);
  if (Number.isNaN(date.getTime())) fail(ErrorCode.INV_INVALID_DATES, 400);
  return date;
}

function optionalDate(value: string | undefined): Date | undefined {
  return value ? requireDate(value) : undefined;
}

function computeOrFail(items: LineItemInput[], vatEnabled: boolean, vatPercent: string | number) {
  try {
    return computeInvoice(items, vatEnabled, vatPercent);
  } catch (error) {
    if (error instanceof InvoiceInputError) fail(ErrorCode.INV_INVALID_LINES, 400, error);
    throw error;
  }
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
 * Port of the legacy InvoicesService for the CRUD + totals part.
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
    if (!dto.customerId) fail(ErrorCode.SYS_VALIDATION_ERROR, 400);
    if (!dto.lineItems?.length) fail(ErrorCode.INV_NO_LINES, 400);
    const dueDate = requireDate(dto.dueDate);
    const fromDate = requireDate(dto.fromDate);
    const toDate = requireDate(dto.toDate);
    const vatEnabled = dto.vatEnabled ?? true;
    const vatPercent = dto.vatPercent?.trim() ? dto.vatPercent : DEFAULT_VAT_PERCENT;
    const { rows, subtotal, vatAmount, total } = computeOrFail(dto.lineItems, vatEnabled, vatPercent);

    try {
      const row = await createWithSequence(
        async () => (await prisma.invoice.findFirst({ orderBy: { id: 'desc' }, select: { invoiceNumber: true } }))?.invoiceNumber,
        (n) => `INV-${new Date().getFullYear()}-${String(n).padStart(5, '0')}`,
        (invoiceNumber) =>
          prisma.invoice.create({
            data: {
              invoiceNumber,
              customerId: dto.customerId,
              dueDate,
              fromDate,
              toDate,
              currency: dto.currency || 'SAR',
              invoiceType: dto.invoiceType || 'STANDARD',
              paymentMeans: dto.paymentMeans || 'CASH',
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
          }),
      );
      return mapOut(row);
    } catch (error) {
      fail(ErrorCode.INV_CREATE_FAILED, 500, error);
    }
  },

  async update(id: number, dto: Partial<CreateInvoiceDto> & { status?: string }) {
    const existing = await this.findOne(id);
    const changesAmounts = dto.lineItems !== undefined || dto.vatEnabled !== undefined || dto.vatPercent !== undefined;
    if (changesAmounts && LOCKED_ZATCA_STATUSES.has(existing.zatcaStatus ?? '')) fail(ErrorCode.INV_LOCKED, 400);

    const data: Record<string, unknown> = {
      customerId: dto.customerId || undefined,
      dueDate: optionalDate(dto.dueDate),
      fromDate: optionalDate(dto.fromDate),
      toDate: optionalDate(dto.toDate),
      currency: dto.currency || undefined,
      invoiceType: dto.invoiceType || undefined,
      paymentMeans: dto.paymentMeans || undefined,
      status: dto.status || undefined,
    };

    // proto3 repeated fields decode as [] when absent, so an empty list means "leave the lines alone".
    const newLines = dto.lineItems?.length ? dto.lineItems : undefined;
    if (newLines) {
      const vatEnabled = dto.vatEnabled ?? existing.vatEnabled;
      const vatPercent = dto.vatPercent?.trim() ? dto.vatPercent : existing.vatPercent.toString();
      const { rows, subtotal, vatAmount, total } = computeOrFail(newLines, vatEnabled, vatPercent);
      Object.assign(data, { vatEnabled, vatPercent, subtotal, vatAmount, total });
      // Replace the lines and the totals in one transaction: previously the old lines were deleted
      // first and a failing update left the invoice with no lines at all.
      data.lineItems = { deleteMany: {}, create: rows };
    }

    try {
      const row = await prisma.invoice.update({ where: { id }, data, include: INVOICE_INCLUDE });
      return mapOut(row);
    } catch (error) {
      fail(ErrorCode.INV_UPDATE_FAILED, 500, error);
    }
  },

  async remove(id: number) {
    await this.findOne(id);
    try {
      // Line items cascade (schema: onDelete: Cascade); linked trips are released (SetNull).
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
    const settings = await prisma.companySettings.findFirst({ orderBy: { id: 'asc' } });
    try {
      const invoiceUuid = crypto.randomUUID();
      const qrCode = buildZatcaQrTlv({
        sellerName: settings?.companyName ?? 'FleetFlow',
        vatNumber: settings?.vatNumber ?? '',
        // Tag 3 is the invoice's own issue timestamp, not the moment it was submitted.
        timestampIso: zatcaTimestamp(existing.issueDate),
        totalWithVat: existing.total.toFixed(2),
        vatAmount: existing.vatAmount.toFixed(2),
      });
      const invoiceHash = crypto.createHash('sha256').update(`${existing.invoiceNumber}|${existing.total}|${invoiceUuid}`).digest('base64');

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
