'use client';

import { CrudPage } from '../../components/CrudPage';
import { PageLoading } from '../../components/PageLoading';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../lib/auth-context';
import { useLookups } from '../../lib/use-lookups';
import { usersClient, UserDto } from '../../lib/grpc/users';
import { rolesClient } from '../../lib/grpc/roles';

export default function UsersPage() {
  const { token } = useAuth();
  const { data: roles, error: lookupError } = useLookups<{ value: string; label: string }[]>(async (token) => {
    // The role picker needs roles:view; without it the page still works, just with no roles to pick.
    const rows = await rolesClient.list(token).catch(() => []);
    return rows.map((r) => ({ value: String(r.id), label: r.name }));
  }, []);

  if (!roles) return <PageLoading title="Users" error={lookupError} />;

  function toApi(values: Record<string, string>) {
    const dto: Record<string, unknown> = {
      name: values.name,
      email: values.email,
      username: values.username || undefined,
      roleId: values.roleId ? Number(values.roleId) : undefined,
      language: values.language,
      status: values.status,
    };
    if (values.password) dto.password = values.password;
    return dto;
  }

  return (
    <CrudPage<UserDto>
      title="Users"
      addLabel="User"
      emptyLabel="No users yet."
      columns={[
        { header: 'Name', render: (r) => r.name },
        { header: 'Email', render: (r) => r.email },
        { header: 'Username', render: (r) => r.username ?? '—' },
        { header: 'Role', render: (r) => r.roleName ?? r.role },
        { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
      fetchAll={() => usersClient.list(token!)}
      onCreate={(values) => usersClient.create(toApi(values), token!)}
      onUpdate={(id, values) => usersClient.update(id, toApi(values), token!)}
      onDelete={(id) => usersClient.remove(id, token!)}
      formFields={[
        { name: 'name', label: 'Full name', required: true },
        { name: 'email', label: 'Email', required: true },
        { name: 'username', label: 'Username' },
        { name: 'password', label: 'Password (leave blank to keep unchanged when editing)' },
        { name: 'roleId', label: 'Role', type: 'select', options: roles },
        {
          name: 'language',
          label: 'Language',
          type: 'select',
          options: [
            { value: 'en', label: 'English' },
            { value: 'ar', label: 'Arabic' },
          ],
        },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'ACTIVE', label: 'Active' },
            { value: 'INACTIVE', label: 'Inactive' },
          ],
        },
      ]}
      emptyValues={{ name: '', email: '', username: '', password: '', roleId: '', language: 'en', status: 'ACTIVE' }}
      toFormValues={(r) => ({
        name: r.name,
        email: r.email,
        username: r.username ?? '',
        password: '',
        roleId: r.roleId ? String(r.roleId) : '',
        language: r.language,
        status: r.status,
      })}
    />
  );
}
