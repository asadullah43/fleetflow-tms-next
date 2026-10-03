import type { IconName } from '../components/icons';

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
}

export interface NavGroup {
  label: string;
  icon: IconName;
  items: NavItem[];
  /** Renders as a single plain link (no header/chevron/collapse) instead
   *  of a collapsible section — for a group that's just one page, where
   *  the group wrapper adds a click with nothing to show for it. */
  standalone?: boolean;
}

/**
 * Sidebar nav grouped the way a dispatcher actually thinks about the
 * business, not an alphabetical dump of all 20 modules. Each group is a
 * collapsible section (header icon + label + chevron) in the sidebar,
 * except a `standalone` one, which is just a direct link.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Dashboard',
    icon: 'dashboard',
    items: [{ label: 'Dashboard', href: '/dashboard', icon: 'dashboard' }],
    standalone: true,
  },
  {
    label: 'Operations',
    icon: 'route',
    items: [
      { label: 'Trips', href: '/trips', icon: 'route' },
      { label: 'Loading Orders', href: '/loading-orders', icon: 'clipboard' },
    ],
  },
  {
    label: 'Accounts',
    icon: 'creditCard',
    items: [
      { label: 'Invoices', href: '/invoices', icon: 'invoice' },
      { label: 'Supplier Payments', href: '/supplier-payments', icon: 'creditCard' },
    ],
  },
  {
    label: 'Workshop',
    icon: 'wrench',
    items: [
      { label: 'Work Orders', href: '/workshop/work-orders', icon: 'wrench' },
      { label: 'Maintenance', href: '/workshop/maintenance', icon: 'userCog' },
      { label: 'Inspections', href: '/workshop/inspections', icon: 'fileCheck' },
      { label: 'Expenses', href: '/workshop/expenses', icon: 'invoice' },
    ],
  },
  {
    label: 'Inventory',
    icon: 'box',
    items: [
      { label: 'Stock', href: '/inventory', icon: 'box' },
      { label: 'Items', href: '/inventory/items', icon: 'clipboard' },
      { label: 'Warehouses', href: '/inventory/warehouses', icon: 'building' },
    ],
  },
  {
    label: 'Master Data',
    icon: 'menu',
    items: [
      { label: 'Trucks', href: '/trucks', icon: 'truck' },
      { label: 'Drivers', href: '/drivers', icon: 'driver' },
      { label: 'Truck-Driver Assignments', href: '/assignments', icon: 'link' },
      { label: 'Suppliers', href: '/suppliers', icon: 'building' },
      { label: 'Customers', href: '/customers', icon: 'users' },
      { label: 'Locations', href: '/locations', icon: 'mapPin' },
      { label: 'Cargo Types', href: '/cargo-types', icon: 'box' },
      { label: 'Rate Contracts', href: '/rate-contracts', icon: 'fileText' },
    ],
  },
  {
    label: 'Human Resources',
    icon: 'userCog',
    items: [
      { label: 'Departments', href: '/hr/departments', icon: 'building' },
      { label: 'Designations', href: '/hr/designations', icon: 'fileText' },
      { label: 'Employees', href: '/hr/employees', icon: 'users' },
      { label: 'Attendance', href: '/hr/attendance', icon: 'calendar' },
      { label: 'Leave Requests', href: '/hr/leave-requests', icon: 'clipboard' },
      { label: 'Documents', href: '/hr/documents', icon: 'fileCheck' },
      { label: 'Contracts', href: '/hr/contracts', icon: 'fileText' },
    ],
  },
  {
    label: 'Administration',
    icon: 'shield',
    items: [
      { label: 'Users', href: '/users', icon: 'users' },
      { label: 'Roles', href: '/roles', icon: 'shield' },
      { label: 'Company Settings', href: '/settings/company', icon: 'settings' },
      { label: 'ZATCA', href: '/settings/zatca', icon: 'fileCheck' },
      { label: 'API Keys', href: '/settings/api-keys', icon: 'link' },
    ],
  },
];

/**
 * Where to land after sign-in: the dashboard when the role can see it,
 * otherwise the first sidebar page it can. `canView` takes a page href.
 */
export function firstAllowedHref(canView: (href: string) => boolean): string {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (canView(item.href)) return item.href;
    }
  }
  return '/dashboard';
}

/** The sidebar page a path belongs to (longest match, so nested pages resolve to their section). */
export function navItemFor(pathname: string): NavItem | null {
  let best: NavItem | null = null;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if ((pathname === item.href || pathname.startsWith(`${item.href}/`)) && (!best || item.href.length > best.href.length)) best = item;
    }
  }
  return best;
}
