import { rpc } from '../../lib/grpc-handler.js';
import { authService } from './auth.service.js';

/** gRPC service implementation for auth.proto's AuthService (replacement for the legacy AuthController). */
export const authGrpcImpl = {
  login: rpc('public', (req: { username: string; password: string; language?: string }) =>
    authService.login(req.username, req.password, req.language || undefined),
  ),
  getMe: rpc('authenticated', (_req, principal) => authService.getMe(principal!.userId), 'read'),
  updateLanguage: rpc('authenticated', (req: { language: string }, principal) =>
    authService.updateLanguage(principal!.userId, req.language),
  ),
  getMyPermissions: rpc(
    'authenticated',
    async (_req, principal) => ({ permissions: await authService.getMyPermissions(principal!.userId) }),
    'read',
  ),
};
