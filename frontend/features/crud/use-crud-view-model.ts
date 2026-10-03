'use client';

import { useCallback, useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '../../lib/api/errors';
import { exportCsv, printTable } from '../../lib/export-table';
import { newIdempotencyKey } from '../../lib/idempotency';
import { queryKeys } from '../../lib/api/query-keys';
import { useLanguage, useT } from '../../lib/language-context';
import { useResourceMutations } from './crud.queries';
import { emptyValues, fieldsFor, rowToValues, validateValues, valuesToPayload } from './form-mapping';
import type { CrudDefinition, DisplayContext, FormValues } from './types';
import { useNotifiedRemove, usePagedList } from './use-paged-list';

interface Editor<T> {
  mode: 'create' | 'edit';
  row?: T;
  /** One key per opened "new record" form: pressing Save twice, or retrying after a timeout, cannot create two records. */
  idempotencyKey: string;
}

/**
 * ViewModel for a CRUD screen: everything the view shows and every
 * action it can trigger, with no JSX and no direct API calls — server
 * state comes from the query/mutation hooks, list criteria from the list
 * store, and only the open form's draft is local to the screen.
 */
export function useCrudViewModel<T extends { id: number }>(definition: CrudDefinition<T>) {
  const { api, fields, columns } = definition;
  const t = useT();
  const { language } = useLanguage();
  const ctx = useMemo<DisplayContext>(() => ({ language, t }), [language, t]);

  const list = usePagedList(api);
  const { controls } = list;
  const mutations = useResourceMutations(api);
  const queryClient = useQueryClient();
  /** Refreshes the other resources this one's writes change (definition.invalidates). */
  const refreshRelated = useCallback(() => {
    for (const key of definition.invalidates ?? []) void queryClient.invalidateQueries({ queryKey: queryKeys.resource(key) });
  }, [definition.invalidates, queryClient]);

  const [editor, setEditor] = useState<Editor<T> | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const openForm = useCallback((next: Editor<T>, initial: FormValues) => {
    setValues(initial);
    setFieldErrors({});
    setFormError(null);
    setEditor(next);
  }, []);

  const valuesOf = useCallback(
    (row: T) => {
      const derived = rowToValues(fields, row as unknown as Record<string, unknown>);
      return definition.toFormValues ? definition.toFormValues(derived, row, ctx) : derived;
    },
    [fields, definition, ctx],
  );

  const openCreate = useCallback(() => openForm({ mode: 'create', idempotencyKey: newIdempotencyKey() }, emptyValues(fields)), [openForm, fields]);
  const openEdit = useCallback((row: T) => openForm({ mode: 'edit', row, idempotencyKey: '' }, valuesOf(row)), [openForm, valuesOf]);
  /** A new record pre-filled from an existing one; nothing is saved until the user reviews it and presses Save. */
  const openDuplicate = useCallback((row: T) => openForm({ mode: 'create', idempotencyKey: newIdempotencyKey() }, valuesOf(row)), [openForm, valuesOf]);

  const closeEditor = useCallback(() => setEditor(null), []);

  const { derive } = definition;
  const setValue = useCallback((name: string, value: string) => {
    setValues((current) => {
      const next = { ...current, [name]: value };
      return derive ? derive(next, current, name) : next;
    });
    setFieldErrors((current) => (current[name] ? { ...current, [name]: '' } : current));
  }, [derive]);

  const saving = mutations.create.isPending || mutations.update.isPending;

  const save = useCallback(async () => {
    if (!editor || saving) return;
    // Only what the form shows is checked and sent (an edit-only field never goes out with a new record).
    const shown = fieldsFor(fields, editor.mode);
    const errors = validateValues(shown, values, editor.mode);
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    const base = valuesToPayload(shown, values);
    const payload = definition.toApi ? definition.toApi(base, values, editor.mode) : base;
    setFormError(null);
    try {
      if (editor.mode === 'edit' && editor.row) await mutations.update.mutateAsync({ id: editor.row.id, values: payload });
      else await mutations.create.mutateAsync({ values: payload, idempotencyKey: editor.idempotencyKey });
      refreshRelated();
      setEditor(null);
      notifications.show({ color: 'teal', message: t(editor.mode === 'edit' ? 'Changes saved.' : 'Record added.') });
    } catch (error) {
      setFormError(errorMessage(error, 'Save failed.'));
    }
  }, [editor, saving, fields, values, definition, mutations.update, mutations.create, refreshRelated, t]);

  const removeAndRefresh = useCallback(async (id: number) => {
    await mutations.remove.mutateAsync(id);
    refreshRelated();
  }, [mutations.remove, refreshRelated]);
  const removeById = useNotifiedRemove(removeAndRefresh);
  const remove = useCallback((row: T) => removeById(row.id), [removeById]);

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
    ...list,
    ctx,
    editor,
    values,
    fieldErrors,
    formError,
    saving,
    deletingId: mutations.remove.isPending ? mutations.remove.variables : null,
    exporting,
    openCreate,
    openEdit,
    openDuplicate,
    closeEditor,
    setValue,
    save,
    remove,
    exportRows,
  };
}

export type CrudViewModel<T extends { id: number }> = ReturnType<typeof useCrudViewModel<T>>;
