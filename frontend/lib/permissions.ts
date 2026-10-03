/**
 * Frontend mirror of the backend permission matrix (backend/utils/
 * permissions.ts). The backend is the real gate — every RPC is
 * checked there — this only decides what to *show*, so users aren't
 * offered pages and buttons that would just fail with "permission denied".
 */
export type PermissionAction = 'view' | 'add' | 'edit' | 'delete';

export interface PermissionRow {
  module: string;
  canView?: boolean;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

const FLAG: Record<PermissionAction, keyof Omit<PermissionRow, 'module'>> = {
  view: 'canView',
  add: 'canAdd',
  edit: 'canEdit',
  delete: 'canDelete',
};

export function hasPermission(rows: PermissionRow[] | null, module: string, action: PermissionAction): boolean {
  if (!rows) return false;
  return rows.find((r) => r.module === module)?.[FLAG[action]] === true;
}

/**
 * Which permission module guards each page, by URL prefix (longest match
 * wins). Pages not listed (e.g. a future one) are treated as unrestricted
 * in the UI; the backend still enforces whatever its RPCs require.
 */
const PAGE_MODULES: [prefix: string, module: string][] = [
  ['/dashboard', 'dashboard'],
  ['/trips', 'trips'],
  ['/loading-orders', 'loadingOrders'],
  ['/invoices', 'invoices'],
  ['/supplier-payments', 'supplierPayments'],
  ['/workshop', 'workshop'],
  ['/inventory', 'inventory'],
  ['/trucks', 'trucks'],
  ['/drivers', 'drivers'],
  ['/assignments', 'assignments'],
  ['/suppliers', 'suppliers'],
  ['/customers', 'customers'],
  ['/locations', 'locations'],
  ['/cargo-types', 'cargoTypes'],
  ['/rate-contracts', 'rateContracts'],
  ['/hr', 'hr'],
  // Its own module (apply = add, approve = edit), so it can be granted without the rest of HR.
  ['/hr/leave-requests', 'leaveRequests'],
  ['/users', 'users'],
  ['/roles', 'roles'],
  ['/settings', 'settings'],
  ['/settings/api-keys', 'apiKeys'],
];

export function moduleForPath(pathname: string): string | null {
  let best: [string, string] | null = null;
  for (const entry of PAGE_MODULES) {
    const [prefix] = entry;
    if ((pathname === prefix || pathname.startsWith(prefix + '/')) && (!best || prefix.length > best[0].length)) best = entry;
  }
  return best ? best[1] : null;
}

/** A permission module's display name: "cargoTypes" -> "Cargo types" (then translated). */
export function formatModule(module: string): string {
  const spaced = module.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
