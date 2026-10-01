import type { PermissionFlags } from '../utils/permissions.js';

export type AuthMethod = 'JWT' | 'API_KEY';

/**
 * Who is making a request, as established by middlewares/authentication.ts.
 * `companyId` always comes from the verified credential — never from the
 * request body.
 */
export interface Principal {
  authMethod: AuthMethod;
  companyId: number;
  /** Set for JWT sessions. */
  userId: number | null;
  /** Set for API-key calls. */
  apiKeyId: number | null;
  /** Role name for JWT sessions (ADMIN bypasses the matrix); null for API keys. */
  roleName: string | null;
  /** The role's (or API key's) grants, one row per module it has anything on. */
  permissions: ({ module: string } & PermissionFlags)[];
}
