export interface NavItem {
  label: string;
  href: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Sidebar nav grouped the way a dispatcher actually thinks about the
 * business, not an alphabetical dump of all 19 modules.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', href: '/dashboard' }],
  },
  {
    label: 'Fleet',
    items: [
      { label: 'Trucks', href: '/trucks' },
      { label: 'Drivers', href: '/drivers' },
      { label: 'Locations', href: '/locations' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Trips', href: '/trips' },
      { label: 'Loading Orders', href: '/loading-orders' },
      { label: 'Cargo Types', href: '/cargo-types' },
      { label: 'Rate Contracts', href: '/rate-contracts' },
    ],
  },
  {
    label: 'Commercial',
    items: [
      { label: 'Customers', href: '/customers' },
      { label: 'Suppliers', href: '/suppliers' },
      { label: 'Supplier Payments', href: '/supplier-payments' },
    ],
  },
  {
    label: 'Finance',
    items: [{ label: 'Invoices', href: '/invoices' }],
  },
  {
    label: 'Workforce',
    items: [{ label: 'HR', href: '/hr' }],
  },
  {
    label: 'Workshop',
    items: [{ label: 'Workshop', href: '/workshop' }],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Users', href: '/users' },
      { label: 'Roles', href: '/roles' },
      { label: 'Company Settings', href: '/settings/company' },
      { label: 'ZATCA', href: '/settings/zatca' },
    ],
  },
];
