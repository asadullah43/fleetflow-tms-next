import { cachedRead } from '../_core_app_connectivities/cache.js';
import crypto from 'node:crypto';
import { prisma } from '../_core_app_connectivities/prisma.js';
import { currentCompanyId } from '../_core_app_connectivities/tenant-context.js';
import { AppError } from '../classes/app-error.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { config } from '../global_config/index.js';
import type { ListQuery } from '../models/api-response.js';
import { computeInvoice, InvoiceInputError, LineItemInput } from '../utils/invoice-math.js';
import { filter, ListConfig, paginate } from '../utils/pagination.js';
import { createWithSequence } from '../utils/sequence.js';
import { buildZatcaQrTlv, zatcaTimestamp } from '../utils/zatca-qr.js';

const INVOICE_INCLUDE = { customer: { select: { name: true, nameAr: true } }, lineItems: true } as const;

const LIST: ListConfig = {
  searchFields: ['invoiceNumber', 'customer.name', 'customer.nameAr'],
  sortFields: { id: 'id', invoiceNumber: 'invoiceNumber', issueDate: 'issueDate', dueDate: 'dueDate', total: 'total', status: 'status' },
  defaultSort: { field: 'id', order: 'desc' },
  filters: {
    status: filter.equals('status'),
    zatcaStatus: filter.equals('zatcaStatus'),
    customerId: filter.id('customerId'),
    fromDate: filter.dateFrom('issueDate'),
    toDate: filter.dateTo('issueDate'),
  },
};

/** Once ZATCA has a QR/hash for an invoice, its amounts must not change. */
const LOCKED_ZATCA_STATUSES = new Set(['SIGNED', 'REPORTED', 'CLEARED']);

const DEFAULT_VAT_PERCENT = '15';

function mapOut(row: any) {
  return { ...row, customerName: row.customer?.name, customerNameAr: row.customer?.nameAr };
}

function computeOrFail(items: LineItemInput[], vatEnabled: boolean, vatPercent: string | number) {
  try {
    return computeInvoice(items, vatEnabled, vatPercent);
  } catch (error) {
    if (error instanceof InvoiceInputError) throw AppError.from(ErrorCode.INV_INVALID_LINES, 400, error);
    throw error;
  }
}

const optionalDate = (value: string | undefined) => (value ? new Date(value) : undefined);

interface InvoiceInput {
  customerId?: number;
  dueDate?: string;
  fromDate?: string;
  toDate?: string;
  currency?: string;
  invoiceType?: string;
  paymentMeans?: string;
  vatEnabled?: boolean;
  vatPercent?: string;
  status?: string;
  lineItems?: LineItemInput[];
}

/**
 * Invoices with server-computed, cent-exact totals. ZATCA support is the
 * Phase-1 QR (see utils/zatca-qr.ts): `submitToZatca` generates the TLV
 * QR and marks the invoice SIGNED, after which its amounts are locked.
 * Phase-2 clearance against ZATCA's live API is not implemented.
 */
export const invoicesService = {
  async list(query: ListQuery) {
    try {
      return await cachedRead('Invoice.list', { query }, config.cache.listTtlSeconds, () => paginate(prisma.invoice, query, LIST, { extra: { include: INVOICE_INCLUDE }, map: mapOut }));
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.from(ErrorCode.INV_FETCH_FAILED, 500, error);
    }
  },

  async findOne(id: number) {
    const row = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (!row) throw AppError.from(ErrorCode.INV_NOT_FOUND, 404);
    return mapOut(row);
  },

  async create(input: InvoiceInput & { customerId: number; dueDate: string; fromDate: string; toDate: string }) {
    if (!input.lineItems?.length) throw AppError.from(ErrorCode.INV_NO_LINES, 400);
    const vatEnabled = input.vatEnabled ?? true;
    const vatPercent = input.vatPercent?.trim() ? input.vatPercent : DEFAULT_VAT_PERCENT;
    const { rows, subtotal, vatAmount, total } = computeOrFail(input.lineItems, vatEnabled, vatPercent);

    try {
      // The invoice and its lines are one nested write — a single transaction.
      const row = await createWithSequence(
        async () => (await prisma.invoice.findFirst({ orderBy: { id: 'desc' }, select: { invoiceNumber: true } }))?.invoiceNumber,
        (n) => `INV-${new Date().getFullYear()}-${String(n).padStart(5, '0')}`,
        (invoiceNumber) =>
          prisma.invoice.create({
            data: {
              companyId: currentCompanyId(),
              invoiceNumber,
              customerId: input.customerId,
              dueDate: new Date(input.dueDate),
              fromDate: new Date(input.fromDate),
              toDate: new Date(input.toDate),
              currency: input.currency || 'SAR',
              invoiceType: input.invoiceType || 'STANDARD',
              paymentMeans: input.paymentMeans || 'CASH',
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
      if (error instanceof AppError) throw error;
      throw AppError.from(ErrorCode.INV_CREATE_FAILED, 500, error);
    }
  },

  async update(id: number, input: InvoiceInput) {
    const existing = await this.findOne(id);
    // proto3 repeated fields decode as [] when absent, so an empty list means "leave the lines alone".
    const newLines = input.lineItems?.length ? input.lineItems : undefined;
    const newVatPercent = input.vatPercent?.trim() || undefined;
    // Re-sending the VAT settings an invoice already has is not a change (edit forms send every field).
    const vatChanged =
      (input.vatEnabled !== undefined && input.vatEnabled !== existing.vatEnabled) ||
      (newVatPercent !== undefined && Number(newVatPercent) !== Number(existing.vatPercent));
    const changesAmounts = newLines !== undefined || vatChanged;
    if (changesAmounts && LOCKED_ZATCA_STATUSES.has(existing.zatcaStatus ?? '')) throw AppError.from(ErrorCode.INV_LOCKED, 400);

    const data: Record<string, unknown> = {
      customerId: input.customerId || undefined,
      dueDate: optionalDate(input.dueDate),
      fromDate: optionalDate(input.fromDate),
      toDate: optionalDate(input.toDate),
      currency: input.currency || undefined,
      invoiceType: input.invoiceType || undefined,
      paymentMeans: input.paymentMeans || undefined,
      status: input.status || undefined,
    };

    if (changesAmounts) {
      const vatEnabled = input.vatEnabled ?? existing.vatEnabled;
      const vatPercent = newVatPercent ?? existing.vatPercent.toString();
      // Changing only the VAT settings re-prices the existing lines (at the new rate, if one was given).
      const lines: LineItemInput[] =
        newLines ??
        existing.lineItems.map((line: any) => ({
          description: line.description,
          quantity: line.quantity.toString(),
          rate: line.rate.toString(),
          taxCategory: line.taxCategory,
          taxPercent: newVatPercent ? undefined : line.taxPercent?.toString(),
        }));
      const { rows, subtotal, vatAmount, total } = computeOrFail(lines, vatEnabled, vatPercent);
      // Lines and totals are replaced in the same write, so they can never disagree.
      Object.assign(data, { vatEnabled, vatPercent, subtotal, vatAmount, total, lineItems: { deleteMany: {}, create: rows } });
    }

    try {
      const row = await prisma.invoice.update({ where: { id }, data, include: INVOICE_INCLUDE });
      return mapOut(row);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.from(ErrorCode.INV_UPDATE_FAILED, 500, error);
    }
  },

  async remove(id: number) {
    await this.findOne(id);
    try {
      // Line items cascade (schema: onDelete: Cascade); linked trips are released (SetNull).
      await prisma.invoice.delete({ where: { id } });
    } catch (error) {
      throw AppError.from(ErrorCode.INV_DELETE_FAILED, 500, error);
    }
  },

  async markPaid(id: number) {
    // The status condition is part of the write, so two simultaneous requests cannot both "pay" it.
    const changed = await prisma.invoice.updateMany({ where: { id, status: { not: 'PAID' } }, data: { status: 'PAID', paidAt: new Date() } });
    const row = await this.findOne(id);
    if (changed.count === 0) throw AppError.from(ErrorCode.INV_STATUS_CONFLICT, 400);
    return row;
  },

  async submitToZatca(id: number) {
    const existing = await this.findOne(id);
    const submittable = !existing.zatcaStatus || existing.zatcaStatus === 'PENDING_SIGN' || existing.zatcaStatus === 'FAILED';
    if (!submittable) throw AppError.from(ErrorCode.ZATCA_ALREADY_SUBMITTED, 400);
    const settings = await prisma.companySettings.findFirst({ select: { companyName: true, vatNumber: true } });
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

      // Only an invoice that is still un-signed is signed: a concurrent second submit changes nothing.
      const changed = await prisma.invoice.updateMany({
        where: { id, OR: [{ zatcaStatus: null }, { zatcaStatus: { in: ['PENDING_SIGN', 'FAILED'] } }] },
        data: { invoiceUuid, qrCode, invoiceHash, zatcaStatus: 'SIGNED', zatcaSubmittedAt: new Date() },
      });
      if (changed.count === 0) throw AppError.from(ErrorCode.ZATCA_ALREADY_SUBMITTED, 400);
      return await this.findOne(id);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.from(ErrorCode.ZATCA_SUBMIT_FAILED, 500, error);
    }
  },
};
