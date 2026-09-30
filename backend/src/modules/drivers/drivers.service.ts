import { createCrudService } from '../../common/crud/crud.service.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

export const driversService = createCrudService('driver', {
  notFound: ErrorCode.DRV_NOT_FOUND,
  inUse: ErrorCode.DRV_IN_USE,
  createFailed: ErrorCode.DRV_CREATE_FAILED,
  fetchFailed: ErrorCode.DRV_FETCH_FAILED,
  updateFailed: ErrorCode.DRV_UPDATE_FAILED,
  deleteFailed: ErrorCode.DRV_DELETE_FAILED,
});
