import { apiCall, MessageType } from './client';
import { ListQuery, MAX_PAGE_SIZE, normalizeListQuery, Page, toPage } from './types';

/** The API of one list/get/create/update/delete resource. `key` namespaces its cached queries. */
export interface CrudApi<T> {
  key: string;
  list(query?: ListQuery): Promise<Page<T>>;
  get(id: number): Promise<T>;
  create(values: Record<string, unknown>, idempotencyKey?: string): Promise<T>;
  update(id: number, values: Record<string, unknown>): Promise<T>;
  remove(id: number): Promise<void>;
  /** Every row matching `query`, fetched page by page (for exports). Stops at `limit` rows. */
  listAll(query?: ListQuery, limit?: number): Promise<T[]>;
}

type Namespace = Record<string, unknown>;

/** Sends one List rpc and returns the standard page shape. Shared with the non-CRUD list endpoints. */
export function listCall<T>(service: string, method: string, ListRequest: MessageType, query: ListQuery = {}): Promise<Page<T>> {
  const normalized = normalizeListQuery(query);
  return apiCall<{ items?: unknown[]; pagination?: Page<T>['pagination'] }>({
    service,
    method,
    RequestType: ListRequest,
    request: { ...normalized, sortBy: normalized.sortBy ?? '', sortOrder: normalized.sortOrder ?? '' },
  }).then((response) => toPage<T>(response, normalized));
}

export async function listEverything<T>(list: (query: ListQuery) => Promise<Page<T>>, query: ListQuery = {}, limit = 5000): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; rows.length < limit; page++) {
    const result = await list({ ...query, page, pageSize: MAX_PAGE_SIZE });
    rows.push(...result.items);
    if (page >= result.pagination.totalPages || result.items.length === 0) break;
  }
  return rows.slice(0, limit);
}

/**
 * Builds the client for a resource whose proto follows the shared
 * convention: `<Entity>sService` with List/Get/Create/Update/Delete, and
 * `ListRequest`, `IdRequest`, `Create<Entity>Request`, `Update<Entity>Request`
 * messages in the same package.
 */
export function createCrudApi<T>(key: string, service: string, messages: Namespace, entity: string): CrudApi<T> {
  const type = (name: string): MessageType => {
    const found = messages[name];
    if (!found) throw new Error(`${service}: proto message ${name} not found`);
    return found as MessageType;
  };
  const ListRequest = type('ListRequest');
  const IdRequest = type('IdRequest');
  const list = (query?: ListQuery) => listCall<T>(service, 'List', ListRequest, query);

  return {
    key,
    list,
    listAll: (query, limit) => listEverything(list, query, limit),
    get: (id) => apiCall<T>({ service, method: 'Get', RequestType: IdRequest, request: { id } }),
    create: (values, idempotencyKey) => apiCall<T>({ service, method: 'Create', RequestType: type(`Create${entity}Request`), request: values, idempotencyKey }),
    update: (id, values) => apiCall<T>({ service, method: 'Update', RequestType: type(`Update${entity}Request`), request: { id, ...values } }),
    remove: (id) => apiCall({ service, method: 'Delete', RequestType: IdRequest, request: { id } }).then(() => undefined),
  };
}
