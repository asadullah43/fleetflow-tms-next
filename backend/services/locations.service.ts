import { createCrudRepository } from '../data_repositories/crud.repository.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { buildLocalizedWriteData } from '../utils/language.js';
import { filter } from '../utils/pagination.js';

export const locationsService = createCrudRepository({
  model: 'location',
  errors: {
    notFound: ErrorCode.LOC_NOT_FOUND,
    inUse: ErrorCode.LOC_IN_USE,
    createFailed: ErrorCode.LOC_CREATE_FAILED,
    fetchFailed: ErrorCode.LOC_FETCH_FAILED,
    updateFailed: ErrorCode.LOC_UPDATE_FAILED,
    deleteFailed: ErrorCode.LOC_DELETE_FAILED,
  },
  list: {
    searchFields: ['name', 'nameAr', 'description', 'descriptionAr'],
    sortFields: { id: 'id', createdAt: 'createdAt', ...{ name: 'name', status: 'status' } },
    defaultSort: { field: 'id', order: 'desc' },
    filters: { status: filter.equals('status') },
  },
  toCreate: (input) => buildLocalizedWriteData(input, true),
  toUpdate: (input) => buildLocalizedWriteData(input, false),
});
