import type { IconName } from '../components/icons';

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Sidebar nav grouped the way a dispatcher actually thinks about the
 * business, not an alphabetical dump of all 20 modules.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', href: '/dashboard', icon: 'dashboard' }],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Trips', href: '/trips', icon: 'route' },
      { label: 'Loading Orders', href: '/loading-orders', icon: 'clipboard' },
    ],
  },
  {
    label: 'Accounts',
    items: [
      { label: 'Invoices', href: '/invoices', icon: 'invoice' },
      { label: 'Supplier Payments', href: '/supplier-payments', icon: 'creditCard' },
    ],
  },
  {
    label: 'Workshop',
    items: [{ label: 'Workshop', href: '/workshop', icon: 'wrench' }],
  },
  {
    label: 'Master Data',
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
    items: [{ label: 'HR', href: '/hr', icon: 'userCog' }],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users', href: '/users', icon: 'users' },
      { label: 'Roles', href: '/roles', icon: 'shield' },
      { label: 'Company Settings', href: '/settings/company', icon: 'settings' },
      { label: 'ZATCA', href: '/settings/zatca', icon: 'fileCheck' },
    ],
  },
];
