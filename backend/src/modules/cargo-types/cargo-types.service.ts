import { createCrudService } from '../../common/crud/crud.service.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

export const cargoTypesService = createCrudService('cargoType', {
  notFound: ErrorCode.CGO_NOT_FOUND,
  inUse: ErrorCode.CGO_IN_USE,
  createFailed: ErrorCode.CGO_CREATE_FAILED,
  fetchFailed: ErrorCode.CGO_FETCH_FAILED,
  updateFailed: ErrorCode.CGO_UPDATE_FAILED,
  deleteFailed: ErrorCode.CGO_DELETE_FAILED,
});
