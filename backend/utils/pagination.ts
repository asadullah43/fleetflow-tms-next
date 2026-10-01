/**
 * Server-side pagination, search, sort and filtering for list endpoints.
 * A service declares what is searchable/sortable/filterable; the client
 * only names them. Nothing from the request reaches Prisma unvalidated.
 */
import { AppError } from '../classes/app-error.js';
import { ErrorCode } from '../global_config/error-codes.js';
import type { ListQuery, Paginated, Pagination } from '../models/api-response.js';

type Where = Record<string, unknown>;

export interface ListConfig {
  /** String columns matched (case-insensitive "contains") by `search`. Dot paths reach relations: 'customer.name'. */
  searchFields: string[];
  /** Allowed `sortBy` values -> column or relation path. */
  sortFields: Record<string, string>;
  defaultSort: { field: string; order: 'asc' | 'desc' };
  /** Allowed `filters` keys -> the Prisma `where` fragment for a value. */
  filters?: Record<string, (value: string) => Where>;
}

/** { a: { b: leaf } } from 'a.b' */
function nest(path: string, leaf: unknown): Where {
  return path
    .split('.')
    .reverse()
    .reduce<unknown>((acc, key) => ({ [key]: acc }), leaf) as Where;
}

function invalid(description: string): never {
  throw AppError.from(ErrorCode.SYS_VALIDATION_ERROR, 400, undefined, description);
}

// ── Reusable filter builders ────────────────────────────────────────────
export const filter = {
  /** Exact match on a string column. */
  equals: (column: string) => (value: string) => nest(column, value),
  /** Exact match on an integer column (ids). */
  id: (column: string) => (value: string) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) invalid(`Filter "${column}" must be a positive whole number.`);
    return nest(column, id);
  },
  /** Inclusive lower bound on a date column, value "YYYY-MM-DD". */
  dateFrom: (column: string) => (value: string) => nest(column, { gte: parseDay(value, column) }),
  /** Inclusive upper bound (end of that day) on a date column. */
  dateTo: (column: string) => (value: string) => {
    const day = parseDay(value, column);
    return nest(column, { lt: new Date(day.getTime() + 24 * 60 * 60 * 1000) });
  },
};

function parseDay(value: string, column: string): Date {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) invalid(`Filter "${column}" must be a date (YYYY-MM-DD).`);
  return date;
}

export interface ListArgs {
  where: Where;
  orderBy: Where[];
  skip: number;
  take: number;
}

/** Turns a validated ListQuery into Prisma findMany arguments, merged with the service's own `baseWhere`. */
export function buildListArgs(query: ListQuery, config: ListConfig, baseWhere: Where = {}): ListArgs {
  const and: Where[] = [baseWhere];

  const search = query.search.trim();
  if (search && config.searchFields.length > 0) {
    and.push({ OR: config.searchFields.map((field) => nest(field, { contains: search, mode: 'insensitive' })) });
  }

  for (const [key, value] of Object.entries(query.filters)) {
    if (value === '') continue;
    const build = config.filters?.[key];
    if (!build) invalid(`Unknown filter "${key}".`);
    and.push(build(value));
  }

  let sortPath = config.sortFields[config.defaultSort.field] ?? config.defaultSort.field;
  let sortOrder = config.defaultSort.order;
  if (query.sortBy) {
    const path = config.sortFields[query.sortBy];
    if (!path) invalid(`Cannot sort by "${query.sortBy}".`);
    sortPath = path;
    sortOrder = query.sortOrder;
  }
  // id as a tiebreaker keeps page boundaries stable when the sort column has duplicates.
  const orderBy: Where[] = [nest(sortPath, sortOrder)];
  if (sortPath !== 'id') orderBy.push({ id: 'desc' });

  return { where: { AND: and }, orderBy, skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

export function paginationMeta(query: ListQuery, totalItems: number): Pagination {
  return { page: query.page, pageSize: query.pageSize, totalItems, totalPages: Math.ceil(totalItems / query.pageSize) };
}

interface ListDelegate {
  findMany(args: Record<string, unknown>): Promise<unknown[]>;
  count(args: { where: Where }): Promise<number>;
}

/**
 * Runs the page query and the total count together and returns the
 * standard list payload. `extra` carries include/select; `map` reshapes rows.
 */
export async function paginate<Row, Out = Row>(
  delegate: unknown,
  query: ListQuery,
  config: ListConfig,
  options: { baseWhere?: Where; extra?: Record<string, unknown>; map?: (row: Row) => Out } = {},
): Promise<Paginated<Out>> {
  const d = delegate as ListDelegate;
  const { where, orderBy, skip, take } = buildListArgs(query, config, options.baseWhere);
  const [rows, totalItems] = await Promise.all([d.findMany({ ...options.extra, where, orderBy, skip, take }), d.count({ where })]);
  const map = options.map ?? ((row: Row) => row as unknown as Out);
  return { items: (rows as Row[]).map(map), pagination: paginationMeta(query, totalItems) };
}
