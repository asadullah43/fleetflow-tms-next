import { fleetflow } from '../generated/proto/messages.js';
import { apiCall } from './client';
import { listCall } from './crud-api';
import type { ListQuery } from './types';
import type { PermissionDto } from './roles.api';

const ns = fleetflow.apikeys;
const SERVICE = 'fleetflow.apikeys.ApiKeysService';

export interface ApiKeyDto {
  id: number;
  name: string;
  /** First characters only — the full key is never shown again after creation. */
  keyPrefix: string;
  status: string;
  scopes: PermissionDto[];
  lastUsedAt?: string;
  revokedAt?: string;
  createdAt: string;
  createdByName?: string;
}

export interface CreatedApiKeyDto {
  apiKey: ApiKeyDto;
  plaintextKey: string;
}

export const apiKeysApi = {
  key: 'apiKeys',
  list: (query?: ListQuery) => listCall<ApiKeyDto>(SERVICE, 'List', ns.ListRequest, query),
  create: (values: { name: string; scopes: PermissionDto[] }, idempotencyKey: string) =>
    apiCall<CreatedApiKeyDto>({ service: SERVICE, method: 'Create', RequestType: ns.CreateApiKeyRequest, request: values, idempotencyKey }),
  revoke: (id: number) => apiCall<ApiKeyDto>({ service: SERVICE, method: 'Revoke', RequestType: ns.IdRequest, request: { id } }),
};
