/**
 * Generic data access for the many FleetFlow tables that are plain
 * "list / get / create / update / delete" resources. A service declares
 * its table, how a list may be searched/sorted/filtered, and how request
 * input maps to columns; this supplies the queries, pagination, tenant
 * stamping and consistent error codes — so that logic exists once.
 *
 * Tenant isolation comes from the scoped Prisma client: every query here
 * is automatically limited to the caller's company.
 */
import { prisma } from '../_core_app_connectivities/prisma.js';
import { currentCompanyId } from '../_core_app_connectivities/tenant-context.js';
import { AppError, ErrorCodeEntry } from '../classes/app-error.js';
import type { ListQuery, Paginated } from '../models/api-response.js';
import { ListConfig, paginate } from '../utils/pagination.js';

export interface CrudErrorSet {
  notFound: ErrorCodeEntry;
  inUse: ErrorCodeEntry;
  createFailed: ErrorCodeEntry;
  fetchFailed: ErrorCodeEntry;
  updateFailed: ErrorCodeEntry;
  deleteFailed: ErrorCodeEntry;
  /** Optional module-specific message for a unique-constraint violation; otherwise the generic duplicate error is used. */
  duplicate?: ErrorCodeEntry;
}

type Data = Record<string, unknown>;

interface Delegate {
  create(args: Data): Promise<any>;
  findMany(args: Data): Promise<any[]>;
  findUnique(args: Data): Promise<any>;
  count(args: Data): Promise<number>;
  update(args: Data): Promise<any>;
  delete(args: Data): Promise<any>;
}

export interface CrudRepositoryOptions<Out> {
  /** Prisma client delegate name, e.g. 'truck'. */
  model: string;
  errors: CrudErrorSet;
  list: ListConfig;
  /** Relations to load with every row (for denormalized display names). */
  include?: Data;
  /** Reshapes a database row into the API payload. */
  map?: (row: any) => Out;
  /** Validated create input -> column values. Defaults to the input as-is. */
  toCreate?: (input: any) => Data | Promise<Data>;
  /** Validated update input (+ the current row) -> column values. Defaults to the input as-is. */
  toUpdate?: (input: any, existing: Out) => Data | Promise<Data>;
}

function prismaCode(error: unknown): string | undefined {
  return (error as { code?: string } | null)?.code;
}

/** Wraps an unexpected failure in the module's own error code, keeping the cause for the central error handler. */
function rethrow(error: unknown, code: ErrorCodeEntry, duplicate?: ErrorCodeEntry): never {
  if (error instanceof AppError) throw error;
  if (duplicate && prismaCode(error) === 'P2002') throw AppError.from(duplicate, 409, error);
  throw AppError.from(code, 500, error);
}

export function createCrudRepository<Out = any>(options: CrudRepositoryOptions<Out>) {
  const delegate = (prisma as unknown as Record<string, Delegate>)[options.model];
  const { errors, include } = options;
  const map = options.map ?? ((row: any) => row as Out);
  const extra = include ? { include } : {};

  // Plain closures (no `this`), so a service may re-export individual operations.
  async function list(query: ListQuery, baseWhere: Data = {}): Promise<Paginated<Out>> {
    try {
      return await paginate(delegate, query, options.list, { baseWhere, extra, map });
    } catch (error) {
      rethrow(error, errors.fetchFailed);
    }
  }

  async function findOne(id: number): Promise<Out> {
    const row = await delegate.findUnique({ where: { id }, ...extra });
    if (!row) throw AppError.from(errors.notFound, 404);
    return map(row);
  }

  async function create(input: unknown): Promise<Out> {
    try {
      const data = await (options.toCreate ? options.toCreate(input) : (input as Data));
      const row = await delegate.create({ data: { ...data, companyId: currentCompanyId() }, ...extra });
      return map(row);
    } catch (error) {
      rethrow(error, errors.createFailed, errors.duplicate);
    }
  }

  async function update(id: number, input: unknown): Promise<Out> {
    const existing = await findOne(id);
    try {
      const data = await (options.toUpdate ? options.toUpdate(input, existing) : (input as Data));
      const row = await delegate.update({ where: { id }, data, ...extra });
      return map(row);
    } catch (error) {
      rethrow(error, errors.updateFailed, errors.duplicate);
    }
  }

  async function remove(id: number): Promise<void> {
    await findOne(id);
    try {
      await delegate.delete({ where: { id } });
    } catch (error) {
      // Still referenced by other records: a user-facing "in use", not a server fault.
      if (prismaCode(error) === 'P2003' || prismaCode(error) === 'P2014') throw AppError.from(errors.inUse, 400, error);
      rethrow(error, errors.deleteFailed);
    }
  }

  return { list, findOne, create, update, remove };
}

export type CrudRepository<Out = any> = ReturnType<typeof createCrudRepository<Out>>;

// ── Input-shaping helpers shared by services ────────────────────────────

/** Converts the named date-string fields to Date; '' / undefined become undefined (i.e. "leave unchanged" on update). */
export function withDates<T extends Data>(input: T, fields: string[]): T {
  const out: Data = { ...input };
  for (const field of fields) {
    const value = out[field];
    out[field] = typeof value === 'string' && value !== '' ? new Date(value) : undefined;
  }
  return out as T;
}

/** Turns '' into undefined for the named fields — for optional unique/decimal columns where an empty string is not a value. */
export function blankToUndefined<T extends Data>(input: T, fields: string[]): T {
  const out: Data = { ...input };
  for (const field of fields) if (out[field] === '') out[field] = undefined;
  return out as T;
}
