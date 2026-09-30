/**
 * Direct port of the legacy roles.constants.ts — the fixed list of modules
 * a role's permission matrix covers. Every role gets one Permission row
 * per module (canView/canAdd/canEdit/canDelete), defaulting to all-false.
 */
export const PERMISSION_MODULES: string[] = [
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
  'hr',
  'users',
  'roles',
];
