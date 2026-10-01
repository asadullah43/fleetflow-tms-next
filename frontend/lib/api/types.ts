/** What every list endpoint accepts. Search, sort, filters and paging all run on the server. */
export interface ListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  /** Filter name -> value; empty values are ignored. */
  filters?: Record<string, string>;
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface Page<T> {
  items: T[];
  pagination: Pagination;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Drops empty filters and blank search so equivalent queries share one cache entry. */
export function normalizeListQuery(query: ListQuery = {}): Required<Omit<ListQuery, 'sortBy' | 'sortOrder'>> & Pick<ListQuery, 'sortBy' | 'sortOrder'> {
  const filters: Record<string, string> = {};
  for (const [name, value] of Object.entries(query.filters ?? {})) if (value !== '' && value != null) filters[name] = value;
  return {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? DEFAULT_PAGE_SIZE,
    search: query.search?.trim() ?? '',
    sortBy: query.sortBy || undefined,
    sortOrder: query.sortBy ? (query.sortOrder ?? 'asc') : undefined,
    filters,
  };
}

function toPage<T>(response: { items?: unknown[] | null; pagination?: Partial<Pagination> | null }, query: ListQuery): Page<T> {
  const items = (response.items ?? []) as T[];
  return {
    items,
    pagination: {
      page: response.pagination?.page ?? query.page ?? 1,
      pageSize: response.pagination?.pageSize ?? query.pageSize ?? DEFAULT_PAGE_SIZE,
      totalItems: response.pagination?.totalItems ?? items.length,
      totalPages: response.pagination?.totalPages ?? 1,
    },
  };
}

export { toPage };
