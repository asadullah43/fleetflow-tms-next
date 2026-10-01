'use client';

import { useCallback, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { errorMessage } from '../../lib/api/errors';
import { PermissionDto, RoleDto, rolesApi } from '../../lib/api/roles.api';
import { newIdempotencyKey } from '../../lib/idempotency';
import { useT } from '../../lib/language-context';
import { usePagePermissions } from '../auth/session-provider';
import { useResourceList, useResourceMutations } from '../crud/crud.queries';
import { useListControls } from '../crud/use-list-controls';
import { emptyPermissions, fillPermissions } from './PermissionMatrix';
import { usePermissionModules } from './roles.queries';

interface Editor {
  role?: RoleDto;
  name: string;
  description: string;
  permissions: PermissionDto[];
  idempotencyKey: string;
}

/** State and actions of the Roles screen: the paged list and the name + permission-matrix editor. */
export function useRolesViewModel() {
  const t = useT();
  const allowed = usePagePermissions();
  const controls = useListControls();
  const list = useResourceList(rolesApi, controls.query, allowed.view);
  const modules = usePermissionModules();
  const mutations = useResourceMutations(rolesApi);

  const [editor, setEditor] = useState<Editor | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const moduleList = modules.data;

  const openCreate = useCallback(() => {
    setFormError(null);
    setEditor({ name: '', description: '', permissions: emptyPermissions(moduleList ?? []), idempotencyKey: newIdempotencyKey() });
  }, [moduleList]);

  const openEdit = useCallback(
    (role: RoleDto) => {
      setFormError(null);
      setEditor({ role, name: role.name, description: role.description ?? '', permissions: fillPermissions(moduleList ?? [], role.permissions), idempotencyKey: '' });
    },
    [moduleList],
  );

  const close = useCallback(() => setEditor(null), []);
  const patch = useCallback((changes: Partial<Editor>) => setEditor((current) => (current ? { ...current, ...changes } : current)), []);

  const saving = mutations.create.isPending || mutations.update.isPending;
  const { mutateAsync: create } = mutations.create;
  const { mutateAsync: update } = mutations.update;
  const { mutateAsync: removeAsync } = mutations.remove;

  const save = useCallback(async () => {
    if (!editor || saving) return;
    if (!editor.name.trim()) {
      setFormError('Enter a role name.');
      return;
    }
    const values = { name: editor.name.trim(), description: editor.description, permissions: editor.permissions };
    setFormError(null);
    try {
      if (editor.role) await update({ id: editor.role.id, values });
      else await create({ values, idempotencyKey: editor.idempotencyKey });
      setEditor(null);
      notifications.show({ color: 'teal', message: t(editor.role ? 'Changes saved.' : 'Record added.') });
    } catch (error) {
      setFormError(errorMessage(error, 'Save failed.'));
    }
  }, [editor, saving, create, update, t]);

  const remove = useCallback(
    async (role: RoleDto) => {
      try {
        await removeAsync(role.id);
        notifications.show({ color: 'teal', message: t('Record deleted.') });
      } catch (error) {
        notifications.show({ color: 'red', title: t('Delete failed.'), message: t(errorMessage(error, 'Delete failed.')) });
      }
    },
    [removeAsync, t],
  );

  return {
    allowed,
    controls,
    rows: list.data?.items,
    pagination: list.data?.pagination,
    loading: list.isPending && allowed.view,
    fetching: list.isFetching && !list.isPending,
    listError: list.isError ? errorMessage(list.error, 'Failed to load roles.') : null,
    modulesReady: !!moduleList,
    editor,
    formError,
    saving,
    openCreate,
    openEdit,
    close,
    patch,
    save,
    remove,
  };
}
