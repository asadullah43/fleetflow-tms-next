'use client';

import { useCallback, useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { usePagePermissions } from '../auth/session-provider';
import { errorMessage } from '../../lib/api/errors';
import { exportCsv, printTable } from '../../lib/export-table';
import { newIdempotencyKey } from '../../lib/idempotency';
import { useLanguage, useT } from '../../lib/language-context';
import { useResourceList, useResourceMutations } from './crud.queries';
import { emptyValues, rowToValues, validateValues, valuesToPayload } from './form-mapping';
import type { CrudDefinition, DisplayContext, FormValues } from './types';
import { useListControls } from './use-list-controls';

interface Editor<T> {
  mode: 'create' | 'edit';
  row?: T;
  /** One key per opened "new record" form: pressing Save twice, or retrying after a timeout, cannot create two records. */
  idempotencyKey: string;
}

/**
 * ViewModel for a CRUD screen: everything the view shows and every
 * action it can trigger, with no JSX and no direct API calls — server
 * state comes from the query/mutation hooks.
 */
export function useCrudViewModel<T extends { id: number }>(definition: CrudDefinition<T>) {
  const { api, fields, columns } = definition;
  const t = useT();
  const { language } = useLanguage();
  const ctx = useMemo<DisplayContext>(() => ({ language, t }), [language, t]);
  const allowed = usePagePermissions();

  const controls = useListControls();
  const list = useResourceList(api, controls.query, allowed.view);
  const mutations = useResourceMutations(api);

  const [editor, setEditor] = useState<Editor<T> | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const openCreate = useCallback(() => {
    setValues(emptyValues(fields));
    setFieldErrors({});
    setFormError(null);
    setEditor({ mode: 'create', idempotencyKey: newIdempotencyKey() });
  }, [fields]);

  const openEdit = useCallback(
    (row: T) => {
      const derived = rowToValues(fields, row as unknown as Record<string, unknown>);
      setValues(definition.toFormValues ? definition.toFormValues(derived, row, ctx) : derived);
      setFieldErrors({});
      setFormError(null);
      setEditor({ mode: 'edit', row, idempotencyKey: '' });
    },
    [fields, definition, ctx],
  );

  const closeEditor = useCallback(() => setEditor(null), []);

  const setValue = useCallback((name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => (current[name] ? { ...current, [name]: '' } : current));
  }, []);

  const saving = mutations.create.isPending || mutations.update.isPending;

  const save = useCallback(async () => {
    if (!editor || saving) return;
    const errors = validateValues(fields, values, editor.mode);
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    const base = valuesToPayload(fields, values);
    const payload = definition.toApi ? definition.toApi(base, values, editor.mode) : base;
    setFormError(null);
    try {
      if (editor.mode === 'edit' && editor.row) await mutations.update.mutateAsync({ id: editor.row.id, values: payload });
      else await mutations.create.mutateAsync({ values: payload, idempotencyKey: editor.idempotencyKey });
      setEditor(null);
      notifications.show({ color: 'teal', message: t(editor.mode === 'edit' ? 'Changes saved.' : 'Record added.') });
    } catch (error) {
      setFormError(errorMessage(error, 'Save failed.'));
    }
  }, [editor, saving, fields, values, definition, mutations.update, mutations.create, t]);

  const remove = useCallback(
    async (row: T) => {
      try {
        await mutations.remove.mutateAsync(row.id);
        notifications.show({ color: 'teal', message: t('Record deleted.') });
      } catch (error) {
        notifications.show({ color: 'red', title: t('Delete failed.'), message: t(errorMessage(error, 'Delete failed.')) });
      }
    },
    [mutations.remove, t],
  );

  /** Exports every row matching the current search and filters — not just the page on screen. */
  const exportRows = useCallback(
    async (kind: 'csv' | 'pdf') => {
      setExporting(true);
      try {
        const rows = await api.listAll(controls.criteria);
        const headers = columns.map((column) => t(column.header));
        const data = rows.map((row) =>
          columns.map((column) => {
            const value = column.value(row, ctx);
            return value === null || value === undefined ? '' : String(value);
          }),
        );
        if (kind === 'csv') exportCsv(t(definition.title), headers, data);
        else printTable(t(definition.title), headers, data);
      } catch (error) {
        notifications.show({ color: 'red', title: t('Export failed.'), message: t(errorMessage(error)) });
      } finally {
        setExporting(false);
      }
    },
    [api, controls.criteria, columns, ctx, definition.title, t],
  );

  return {
    ctx,
    allowed,
    controls,
    rows: list.data?.items,
    pagination: list.data?.pagination,
    loading: list.isPending && allowed.view,
    fetching: list.isFetching && !list.isPending,
    listError: list.isError ? errorMessage(list.error, 'Failed to load data.') : null,
    editor,
    values,
    fieldErrors,
    formError,
    saving,
    deletingId: mutations.remove.isPending ? mutations.remove.variables : null,
    exporting,
    openCreate,
    openEdit,
    closeEditor,
    setValue,
    save,
    remove,
    exportRows,
  };
}

export type CrudViewModel<T extends { id: number }> = ReturnType<typeof useCrudViewModel<T>>;
