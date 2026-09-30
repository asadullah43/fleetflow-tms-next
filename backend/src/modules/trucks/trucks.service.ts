import { createCrudService } from '../../common/crud/crud.service.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

export const trucksService = createCrudService('truck', {
  notFound: ErrorCode.TRK_NOT_FOUND,
  inUse: ErrorCode.TRK_IN_USE,
  createFailed: ErrorCode.TRK_CREATE_FAILED,
  fetchFailed: ErrorCode.TRK_FETCH_FAILED,
  updateFailed: ErrorCode.TRK_UPDATE_FAILED,
  deleteFailed: ErrorCode.TRK_DELETE_FAILED,
});
