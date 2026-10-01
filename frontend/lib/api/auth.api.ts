import { fleetflow } from '../generated/proto/messages.js';
import { apiCall } from './client';
import type { PermissionRow } from '../permissions';

const SERVICE = 'fleetflow.auth.AuthService';
const { LoginRequest, GetMeRequest, UpdateLanguageRequest } = fleetflow.auth;

export interface UserProfileDto {
  id: number;
  name: string;
  email: string;
  role?: string;
  roleId?: number;
  language: string;
  companyId: number;
  companyName: string;
}

export interface SessionDto {
  accessToken: string;
  /** ISO timestamp after which the backend rejects the token. */
  expiresAt: string;
  user: UserProfileDto;
}

export const authApi = {
  /** Anonymous by definition: never sends a stale session token along. */
  login(username: string, password: string, language?: string): Promise<SessionDto> {
    return apiCall<SessionDto>({ service: SERVICE, method: 'Login', RequestType: LoginRequest, request: { username, password, language }, token: null });
  },

  /** `token`: check a specific (stored) token before adopting it as the session. */
  getMe(token?: string): Promise<UserProfileDto> {
    return apiCall<UserProfileDto>({ service: SERVICE, method: 'GetMe', RequestType: GetMeRequest, token });
  },

  getMyPermissions(token?: string): Promise<PermissionRow[]> {
    return apiCall<{ permissions?: PermissionRow[] }>({ service: SERVICE, method: 'GetMyPermissions', RequestType: GetMeRequest, token }).then((res) => res.permissions ?? []);
  },

  updateLanguage(language: string): Promise<UserProfileDto> {
    return apiCall<UserProfileDto>({ service: SERVICE, method: 'UpdateLanguage', RequestType: UpdateLanguageRequest, request: { language } });
  },
};
