import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/authentication.js';
import { requireUserSession } from '../middlewares/authorization.js';
import { validate } from '../middlewares/validation.js';
import { loginRequest, updateLanguageRequest } from '../validations/auth.validation.js';
import { emptyRequest } from '../validations/common.validation.js';
import { route, ServiceRoutes } from './router.js';

export const authRoutes: ServiceRoutes = {
  'fleetflow.auth.AuthService': {
    // Public. Protected by the per-IP limit and the failed-attempt limit in the auth service.
    Login: route('fleetflow.auth.LoginResponse', 'write', validate(loginRequest), authController.login),
    GetMe: route('fleetflow.auth.UserProfile', 'read', authenticate, requireUserSession, validate(emptyRequest), authController.getMe),
    UpdateLanguage: route('fleetflow.auth.UserProfile', 'write', authenticate, requireUserSession, validate(updateLanguageRequest), authController.updateLanguage),
    // Works for an API key too: it returns the key's own grants.
    GetMyPermissions: route('fleetflow.auth.PermissionList', 'read', authenticate, validate(emptyRequest), authController.getMyPermissions),
  },
};
