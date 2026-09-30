import { createCrudService } from '../../common/crud/crud.service.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

export const locationsService = createCrudService('location', {
  notFound: ErrorCode.LOC_NOT_FOUND,
  inUse: ErrorCode.LOC_IN_USE,
  createFailed: ErrorCode.LOC_CREATE_FAILED,
  fetchFailed: ErrorCode.LOC_FETCH_FAILED,
  updateFailed: ErrorCode.LOC_UPDATE_FAILED,
  deleteFailed: ErrorCode.LOC_DELETE_FAILED,
});
