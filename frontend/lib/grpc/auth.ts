import { fleetflow } from '../generated/proto/messages.js';
import { unaryCall } from './client';

const SERVICE = 'fleetflow.auth.AuthService';
const { LoginRequest, LoginResponse, GetMeRequest, UpdateLanguageRequest, UserProfile, PermissionList } =
  fleetflow.auth;

export interface UserProfileDto {
  id: number;
  name: string;
  email: string;
  role?: string;
  roleId?: number;
  language: string;
}

/**
 * Frontend port of the old ZatcaService/AuthService-style API client
 * classes (frontend/lib/services/*.dart in the Flutter app) — same
 * calls (login, getMe, updateLanguage, getMyPermissions), now over
 * grpc-web instead of REST.
 */
export const authClient = {
  login(username: string, password: string, language?: string) {
    return unaryCall({
      serviceName: SERVICE,
      methodName: 'Login',
      request: LoginRequest.create({ username, password, language }),
      RequestType: LoginRequest,
      ResponseType: LoginResponse,
    }).then((res) => {
      if (!res.accessToken || !res.user) {
        throw new Error('Malformed login response from server.');
      }
      return {
        accessToken: res.accessToken,
        user: res.user as unknown as UserProfileDto,
      };
    });
  },

  getMe(token: string) {
    return unaryCall({
      serviceName: SERVICE,
      methodName: 'GetMe',
      request: GetMeRequest.create({}),
      RequestType: GetMeRequest,
      ResponseType: UserProfile,
      token,
    }) as Promise<UserProfileDto>;
  },

  updateLanguage(token: string, language: string) {
    return unaryCall({
      serviceName: SERVICE,
      methodName: 'UpdateLanguage',
      request: UpdateLanguageRequest.create({ language }),
      RequestType: UpdateLanguageRequest,
      ResponseType: UserProfile,
      token,
    }) as Promise<UserProfileDto>;
  },

  getMyPermissions(token: string) {
    return unaryCall({
      serviceName: SERVICE,
      methodName: 'GetMyPermissions',
      request: GetMeRequest.create({}),
      RequestType: GetMeRequest,
      ResponseType: PermissionList,
      token,
    }).then((res) => res.permissions ?? []);
  },
};
