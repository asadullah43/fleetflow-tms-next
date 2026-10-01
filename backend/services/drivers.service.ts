import { blankToNull, blankToUndefined, createCrudRepository } from '../data_repositories/crud.repository.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { buildLocalizedWriteData } from '../utils/language.js';
import { filter } from '../utils/pagination.js';

export const driversService = createCrudRepository({
  model: 'driver',
  errors: {
    notFound: ErrorCode.DRV_NOT_FOUND,
    inUse: ErrorCode.DRV_IN_USE,
    createFailed: ErrorCode.DRV_CREATE_FAILED,
    fetchFailed: ErrorCode.DRV_FETCH_FAILED,
    updateFailed: ErrorCode.DRV_UPDATE_FAILED,
    deleteFailed: ErrorCode.DRV_DELETE_FAILED,
  },
  list: {
    searchFields: ['name', 'nameAr', 'phone', 'licenseNo', 'idNumber'],
    sortFields: { id: 'id', createdAt: 'createdAt', ...{ name: 'name', status: 'status' } },
    defaultSort: { field: 'id', order: 'desc' },
    filters: { status: filter.equals('status') },
  },
  // License and ID numbers are unique per company but optional: blank means "none", not the value ''.
  toCreate: (input) => blankToUndefined(buildLocalizedWriteData(input, true), ['licenseNo', 'idNumber']),
  toUpdate: (input) => blankToNull(buildLocalizedWriteData(input, false), ['licenseNo', 'idNumber']),
});
