import { blankToUndefined, createCrudRepository, withDates } from '../data_repositories/crud.repository.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { filter } from '../utils/pagination.js';

export const supplierPaymentsService = createCrudRepository({
  model: 'supplierPayment',
  errors: {
    notFound: ErrorCode.SPP_NOT_FOUND,
    inUse: ErrorCode.SYS_RECORD_IN_USE,
    createFailed: ErrorCode.SPP_CREATE_FAILED,
    fetchFailed: ErrorCode.SPP_FETCH_FAILED,
    updateFailed: ErrorCode.SPP_UPDATE_FAILED,
    deleteFailed: ErrorCode.SPP_DELETE_FAILED,
  },
  include: { supplier: { select: { name: true, nameAr: true } } },
  list: {
    searchFields: ['supplier.name', 'supplier.nameAr', 'description'],
    sortFields: { id: 'id', paymentDate: 'paymentDate', amount: 'amount', supplierName: 'supplier.name' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: { supplierId: filter.id('supplierId'), fromDate: filter.dateFrom('paymentDate'), toDate: filter.dateTo('paymentDate') },
  },
  map: (row) => ({
    id: row.id,
    supplierId: row.supplierId,
    amount: row.amount,
    currency: row.currency,
    paymentDate: row.paymentDate,
    description: row.description,
    supplierName: row.supplier?.name,
    supplierNameAr: row.supplier?.nameAr,
  }),
  toCreate: (input) => ({ ...withDates(input, ['paymentDate']), currency: input.currency || 'SAR', paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date() }),
  toUpdate: (input) => blankToUndefined(withDates(input, ['paymentDate']), ['amount', 'currency']),
});
