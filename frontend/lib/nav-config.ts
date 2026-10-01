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
}

/**
 * Sidebar nav grouped the way a dispatcher actually thinks about the
 * business, not an alphabetical dump of all 20 modules. Each group is a
 * collapsible section (header icon + label + chevron) in the sidebar.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    icon: 'dashboard',
    items: [{ label: 'Dashboard', href: '/dashboard', icon: 'dashboard' }],
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
    items: [{ label: 'Inventory', href: '/inventory', icon: 'box' }],
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
    ],
  },
];
