'use client';

import { useCallback, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { errorMessage } from '../../lib/api/errors';
import { PermissionDto, RoleDto, rolesApi } from '../../lib/api/roles.api';
import { newIdempotencyKey } from '../../lib/idempotency';
import { useT } from '../../lib/language-context';
import { useResourceMutations } from '../crud/crud.queries';
import { useNotifiedRemove, usePagedList } from '../crud/use-paged-list';
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
  const list = usePagedList(rolesApi, { errorFallback: 'Failed to load roles.' });
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

  const removeById = useNotifiedRemove(mutations.remove.mutateAsync);
  const remove = useCallback((role: RoleDto) => removeById(role.id), [removeById]);

  return {
    ...list,
    modulesReady: !!moduleList,
    editor,
    formError,
    saving,
    deletingId: mutations.remove.isPending ? mutations.remove.variables : null,
    openCreate,
    openEdit,
    close,
    patch,
    save,
    remove,
  };
}
