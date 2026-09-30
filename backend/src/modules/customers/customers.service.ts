import { createCrudService } from '../../common/crud/crud.service.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

export const customersService = createCrudService('customer', {
  notFound: ErrorCode.CUS_NOT_FOUND,
  inUse: ErrorCode.CUS_IN_USE,
  createFailed: ErrorCode.CUS_CREATE_FAILED,
  fetchFailed: ErrorCode.CUS_FETCH_FAILED,
  updateFailed: ErrorCode.CUS_UPDATE_FAILED,
  deleteFailed: ErrorCode.CUS_DELETE_FAILED,
});
