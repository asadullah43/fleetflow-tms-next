import { createCrudService } from '../../common/crud/crud.service.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

export const suppliersService = createCrudService('supplier', {
  notFound: ErrorCode.SUP_NOT_FOUND,
  inUse: ErrorCode.SUP_IN_USE,
  createFailed: ErrorCode.SUP_CREATE_FAILED,
  fetchFailed: ErrorCode.SUP_FETCH_FAILED,
  updateFailed: ErrorCode.SUP_UPDATE_FAILED,
  deleteFailed: ErrorCode.SUP_DELETE_FAILED,
});
