import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Which company the current request belongs to. Set once per request by
 * the authentication middleware (from the verified credential) and read
 * by the tenant-scoped Prisma client, so no service can run a query
 * outside its tenant by forgetting a `where`.
 */
interface TenantContext {
  companyId: number | null;
  /** True only for the few pre-authentication lookups (login by username, API-key hash). */
  unscoped: boolean;
}

const store = new AsyncLocalStorage<TenantContext>();

/*
 * Both runners `await fn()` *inside* the context on purpose. Prisma
 * queries are lazy — they only start when awaited — so returning one
 * un-awaited would start it after the context has already ended.
 */
export function runWithTenant<T>(companyId: number, fn: () => PromiseLike<T>): Promise<T> {
  return store.run({ companyId, unscoped: false }, async () => await fn());
}

/**
 * Runs `fn` with tenant scoping switched off. Only for code that must
 * look across companies *before* a tenant is known — keep the callback
 * as small as the single query that needs it.
 */
export function runUnscoped<T>(fn: () => PromiseLike<T>): Promise<T> {
  return store.run({ companyId: null, unscoped: true }, async () => await fn());
}

export function getTenantContext(): TenantContext | undefined {
  return store.getStore();
}

/** The current request's company. Throws if called outside a tenant context (a programming error, not a user error). */
export function currentCompanyId(): number {
  const ctx = store.getStore();
  if (!ctx || ctx.companyId === null) throw new Error('No tenant context: this code must run inside an authenticated request');
  return ctx.companyId;
}
