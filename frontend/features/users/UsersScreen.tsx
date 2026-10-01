'use client';

import { CrudScreen } from '../crud/CrudScreen';
import { ACTIVE_INACTIVE, lookups } from '../crud/lookups';
import type { CrudDefinition } from '../crud/types';
import { usersApi, UserDto } from '../../lib/api/users.api';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
];

const definition: CrudDefinition<UserDto> = {
  api: usersApi,
  title: 'Users',
  description: 'People who can sign in, and the role that decides what each may do.',
  addLabel: 'User',
  searchPlaceholder: 'Name, email or username',
  emptyLabel: 'No users yet.',
  columns: [
    { header: 'Name', value: (r) => r.name, sortKey: 'name' },
    { header: 'Email', value: (r) => r.email, sortKey: 'email' },
    { header: 'Username', value: (r) => r.username },
    { header: 'Role', value: (r) => r.roleName ?? r.role },
    { header: 'Status', value: (r) => r.status, kind: 'status', sortKey: 'status' },
  ],
  filters: [
    { name: 'status', label: 'Status', type: 'select', options: ACTIVE_INACTIVE },
    { name: 'roleId', label: 'Role', type: 'lookup', lookup: lookups.roles },
  ],
  fields: [
    { name: 'name', label: 'Full name', required: true },
    { name: 'email', label: 'Email', required: true },
    { name: 'username', label: 'Username' },
    { name: 'password', label: 'Password', type: 'password', required: true, hint: 'At least 8 characters. Leave blank when editing to keep the current password.' },
    { name: 'roleId', label: 'Role', type: 'lookup', lookup: lookups.roles },
    { name: 'language', label: 'Language', type: 'select', options: LANGUAGES, default: 'en', required: true },
    { name: 'status', label: 'Status', type: 'select', options: ACTIVE_INACTIVE, default: 'ACTIVE', required: true },
  ],
};

export function UsersScreen() {
  return <CrudScreen definition={definition} />;
}
