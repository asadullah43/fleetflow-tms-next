import { apiKeysController } from '../controllers/api-keys.controller.js';
import { authenticate } from '../middlewares/authentication.js';
import { authorize, requireUserSession } from '../middlewares/authorization.js';
import { idempotency } from '../middlewares/idempotency.js';
import { validate } from '../middlewares/validation.js';
import { createApiKeyRequest } from '../validations/api-keys.validation.js';
import { idRequest, listRequest } from '../validations/common.validation.js';
import { route, ServiceRoutes } from './router.js';

const PKG = 'fleetflow.apikeys';
// Keys are managed by signed-in people only: an API key can never create, list or revoke keys.
const people = [authenticate, requireUserSession] as const;

export const apiKeysRoutes: ServiceRoutes = {
  [`${PKG}.ApiKeysService`]: {
    List: route(`${PKG}.ApiKeyList`, 'read', ...people, authorize('apiKeys', 'view'), validate(listRequest), apiKeysController.list),
    Create: route(`${PKG}.CreatedApiKey`, 'write', ...people, authorize('apiKeys', 'add'), validate(createApiKeyRequest), idempotency, apiKeysController.create),
    Revoke: route(`${PKG}.ApiKey`, 'write', ...people, authorize('apiKeys', 'delete'), validate(idRequest), apiKeysController.revoke),
  },
};
