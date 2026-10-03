/**
 * The fixed list of modules a role's permission matrix covers (port of
 * the legacy roles.constants.ts). Every role gets one Permission row per
 * module (canView/canAdd/canEdit/canDelete), defaulting to all-false.
 *
 * `settings` (company settings + ZATCA page) and `apiKeys` (integration
 * keys) were added later — existing roles have no row for them, which
 * means "no access" until an admin grants it on the Roles page.
 *
 * `leaveRequests` was split out of `hr` so filing leave and deciding it
 * can go to different roles: add = apply for leave (create a request,
 * always PENDING), edit = approve / reject (change its status). Its
 * migration copied each role's `hr` grants, so nobody lost access.
 */
export const PERMISSION_MODULES = [
  'dashboard',
  'trucks',
  'drivers',
  'assignments',
  'trips',
  'locations',
  'cargoTypes',
  'rateContracts',
  'loadingOrders',
  'customers',
  'suppliers',
  'supplierPayments',
  'invoices',
  'workshop',
  'inventory',
  'hr',
  'leaveRequests',
  'users',
  'roles',
  'settings',
  'apiKeys',
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];
export type PermissionAction = 'view' | 'add' | 'edit' | 'delete';

export function isPermissionModule(value: unknown): value is PermissionModule {
  return typeof value === 'string' && (PERMISSION_MODULES as readonly string[]).includes(value);
}

/** The built-in role every seeded install has; it bypasses the matrix ("Full system access"). */
export const ADMIN_ROLE_NAME = 'ADMIN';

export interface PermissionFlags {
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

/** What `authorize()` needs to know about the caller to decide. */
export interface PrincipalAccess {
  /** Role name from the Role table, or the legacy `User.role` string for users with no roleId. */
  roleName: string | null;
  /** The caller's permission row for the module being checked, if any. */
  permission: PermissionFlags | null;
}

export function isAdminRole(roleName: string | null | undefined): boolean {
  return (roleName ?? '').trim().toUpperCase() === ADMIN_ROLE_NAME;
}

const FLAG_FOR_ACTION: Record<PermissionAction, keyof PermissionFlags> = {
  view: 'canView',
  add: 'canAdd',
  edit: 'canEdit',
  delete: 'canDelete',
};

/** Pure decision: ADMIN may do anything; everyone else needs the matching flag on the module's row. */
export function isAllowed(access: PrincipalAccess, action: PermissionAction): boolean {
  if (isAdminRole(access.roleName)) return true;
  return access.permission?.[FLAG_FOR_ACTION[action]] === true;
}

/**
 * The full matrix a caller effectively has — what the frontend uses to
 * decide which pages and buttons to show. ADMIN gets every flag on every
 * module even though its role has no Permission rows.
 */
export function effectivePermissions(
  roleName: string | null,
  rows: ({ module: string } & PermissionFlags)[],
): ({ module: PermissionModule } & PermissionFlags)[] {
  const admin = isAdminRole(roleName);
  return PERMISSION_MODULES.map((module) => {
    const row = rows.find((r) => r.module === module);
    return {
      module,
      canView: admin || row?.canView === true,
      canAdd: admin || row?.canAdd === true,
      canEdit: admin || row?.canEdit === true,
      canDelete: admin || row?.canDelete === true,
    };
  });
}

/** Decision for an authenticated principal (JWT user or API key) from its loaded grants. */
export function principalCan(
  principal: { roleName: string | null; permissions: ({ module: string } & PermissionFlags)[] },
  module: PermissionModule,
  action: PermissionAction,
): boolean {
  return isAllowed({ roleName: principal.roleName, permission: principal.permissions.find((p) => p.module === module) ?? null }, action);
}
