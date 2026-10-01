'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { AppShell } from './AppShell';
import { Modal } from './Modal';
import { Icon } from './icons';
import { DateField } from './DateField';
import { SearchSelect } from './SearchSelect';
import { cellText, exportCsv, printTable } from '../lib/export-table';
import { useT } from '../lib/language-context';
import { usePagePermissions } from '../lib/auth-context';
import type { RpcError } from '../lib/grpc/client';

export interface ColumnDef<T> {
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
}

export interface FilterFieldDef {
  name: string;
  label: string;
  type?: 'text' | 'date';
  /** Known values for this column (e.g. every location already added) — renders a searchable dropdown instead of a plain text box. */
  options?: string[];
}

export interface FilterBarDef<T> {
  fields: FilterFieldDef[];
  /** Return true to keep `row` visible given the current filter values. */
  apply: (row: T, filters: Record<string, string>) => boolean;
}

interface CrudPanelProps<T extends { id: number }> {
  columns: ColumnDef<T>[];
  fetchAll: () => Promise<T[]>;
  onCreate: (values: Record<string, string>) => Promise<T>;
  onUpdate: (id: number, values: Record<string, string>) => Promise<T>;
  onDelete: (id: number) => Promise<void>;
  formFields: FormFieldDef[];
  emptyValues: Record<string, string>;
  toFormValues: (row: T) => Record<string, string>;
  emptyLabel?: string;
  addLabel?: string;
  searchPlaceholder?: string;
  /** Extra filter toolbar (date range, column filters, ...) rendered above search/export. */
  filterBar?: FilterBarDef<T>;
  /**
   * Called whenever a form field changes. Return a partial patch of other
   * field values to auto-fill (e.g. picking a truck auto-fills its
   * currently assigned driver) — merged into the form state alongside the
   * field's own new value.
   */
  onValuesChange?: (name: string, value: string, values: Record<string, string>) => Record<string, string> | void;
  /**
   * When provided, a "view" (eye) row action appears and calls this with
   * the row instead of opening the generic edit-form-as-readonly modal —
   * e.g. Truck-Driver Assignments uses it to show that truck's full
   * assignment history. Omitted everywhere else: no view action.
   */
  onView?: (row: T) => void;
}

interface CrudPageProps<T extends { id: number }> extends CrudPanelProps<T> {
  title: string;
  description?: string;
}

export interface FormFieldDef {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'textarea';
  options?: { value: string; label: string }[];
  required?: boolean;
  /** Always shown disabled, value driven by `onValuesChange` — not user-editable. */
  readOnly?: boolean;
}

/**
 * The list+create+edit+delete UI itself, with no page shell — used
 * directly inside a tabbed page (HR, Workshop) that already has its own
 * AppShell. `CrudPage` below is this same panel wrapped in AppShell for a
 * standalone module page.
 */
export function CrudPanel<T extends { id: number }>({
  columns,
  fetchAll,
  onCreate,
  onUpdate,
  onDelete,
  formFields,
  emptyValues,
  toFormValues,
  emptyLabel = 'No records yet.',
  addLabel = 'Add',
  searchPlaceholder,
  exportTitle,
  filterBar,
  onValuesChange,
  onView,
}: CrudPanelProps<T> & { exportTitle?: string }) {
  const t = useT();
  const allowed = usePagePermissions();
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; row?: T } | null>(null);
  const [values, setValues] = useState<Record<string, string>>(emptyValues);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filterDraft, setFilterDraft] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<Record<string, string>>({});

  function load() {
    fetchAll()
      .then((data) => {
        setRows(data);
        setError(null);
      })
      .catch((err) => {
        setError((err as RpcError).message ?? 'Failed to load data.');
        // Leave any rows from a previous successful load; on first load show an empty table rather than "Loading..." forever.
        setRows((prev) => prev ?? []);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasActiveFilters = filterBar ? Object.values(filters).some((v) => v) : false;

  // Known values for the quick-search dropdown — the primary (first)
  // column's rendered text for every loaded row, e.g. every truck number
  // or driver name already in the system, so quick search behaves like
  // the Trips filter fields (type to narrow, or pick straight from the list).
  const quickSearchOptions = useMemo(() => {
    if (!rows || filterBar) return [];
    const primaryColumn = columns[0];
    if (!primaryColumn) return [];
    const values = new Set<string>();
    for (const row of rows) {
      const text = cellText(primaryColumn.render(row));
      if (text) values.add(text);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, columns, filterBar]);

  const visibleRows = useMemo(() => {
    if (!rows) return rows;
    let result = rows;
    if (filterBar && hasActiveFilters) {
      result = result.filter((row) => filterBar.apply(row, filters));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((row) => columns.some((col) => cellText(col.render(row)).toLowerCase().includes(q)));
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, columns, filters, hasActiveFilters]);

  function applyFilters() {
    setFilters(filterDraft);
  }

  function clearFilters() {
    setFilterDraft({});
    setFilters({});
  }

  function updateField(name: string, value: string) {
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      const patch = onValuesChange?.(name, value, next);
      return patch ? { ...next, ...patch } : next;
    });
  }

  function openCreate() {
    setValues(emptyValues);
    setFormError(null);
    setModal({ mode: 'create' });
  }

  function openEdit(row: T) {
    setValues(toFormValues(row));
    setFormError(null);
    setModal({ mode: 'edit', row });
  }

  async function submit() {
    setSaving(true);
    setFormError(null);
    try {
      if (modal?.mode === 'edit' && modal.row) {
        await onUpdate(modal.row.id, values);
      } else {
        await onCreate(values);
      }
      setModal(null);
      load();
    } catch (err) {
      setFormError((err as RpcError).message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: T) {
    if (!confirm(t('Delete this record? This cannot be undone.'))) return;
    try {
      await onDelete(row.id);
      load();
    } catch (err) {
      setError((err as RpcError).message ?? 'Delete failed.');
    }
  }

  function exportRows(kind: 'csv' | 'pdf') {
    if (!visibleRows) return;
    const headers = columns.map((c) => c.header);
    const data = visibleRows.map((row) => columns.map((c) => cellText(c.render(row))));
    const name = exportTitle ?? 'export';
    if (kind === 'csv') exportCsv(name, headers, data);
    else printTable(name, headers, data);
  }

  return (
    <>
      {error && <div className="error-banner">{t(error)}</div>}

      {filterBar && (
        <div className="filter-bar">
          {filterBar.fields.map((f) =>
            f.type === 'date' ? (
              <div className="search-field filter-field" key={f.name}>
                <DateField
                  variant="inline"
                  ariaLabel={t(f.label)}
                  value={filterDraft[f.name] ?? ''}
                  onChange={(v) => setFilterDraft({ ...filterDraft, [f.name]: v })}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                />
              </div>
            ) : f.options ? (
              <SearchSelect
                key={f.name}
                placeholder={t(f.label)}
                options={f.options}
                value={filterDraft[f.name] ?? ''}
                onChange={(v) => setFilterDraft({ ...filterDraft, [f.name]: v })}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              />
            ) : (
              <div className="search-field filter-field" key={f.name}>
                <Icon.search size={15} />
                <input
                  placeholder={t(f.label)}
                  value={filterDraft[f.name] ?? ''}
                  onChange={(e) => setFilterDraft({ ...filterDraft, [f.name]: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                />
              </div>
            )
          )}
        </div>
      )}

      <div className="toolbar">
        {filterBar ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={applyFilters} type="button">
              <Icon.search size={15} /> {t('Search')}
            </button>
            {hasActiveFilters && (
              <button className="btn btn-secondary" onClick={clearFilters} type="button">
                {t('Clear filters')}
              </button>
            )}
          </div>
        ) : (
          <SearchSelect
            className="search-select-wide"
            placeholder={t(searchPlaceholder ?? 'Search...')}
            options={quickSearchOptions}
            value={query}
            onChange={setQuery}
          />
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-excel" onClick={() => exportRows('csv')} type="button">
            <Icon.gridLayers size={15} /> {t('Excel')}
          </button>
          <button className="btn btn-secondary" onClick={() => exportRows('pdf')} type="button">
            <Icon.fileText size={15} /> {t('PDF')}
          </button>
          {allowed.add && (
            <button className="btn btn-primary" onClick={openCreate} type="button">
              <Icon.plus size={15} /> {t(addLabel)}
            </button>
          )}
        </div>
      </div>

      <div className="panel">
        {visibleRows === null ? (
          <div className="empty-state">{t('Loading...')}</div>
        ) : visibleRows.length === 0 ? (
          <div className="empty-state">{rows && rows.length > 0 ? t('No matching records.') : t(emptyLabel)}</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.header} style={{ textAlign: col.align ?? 'left' }}>
                    {t(col.header)}
                  </th>
                ))}
                <th style={{ textAlign: 'right' }}>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  {columns.map((col) => (
                    <td key={col.header} style={{ textAlign: col.align ?? 'left' }}>
                      {col.render(row)}
                    </td>
                  ))}
                  <td>
                    <div className="row-actions">
                      {onView && (
                        <button className="row-action" onClick={() => onView(row)} title={t('View history')}>
                          <Icon.eye size={16} />
                        </button>
                      )}
                      {allowed.edit && (
                        <button className="row-action" onClick={() => openEdit(row)} title={t('Edit')}>
                          <Icon.pencil size={16} />
                        </button>
                      )}
                      {allowed.delete && (
                        <button className="row-action danger" onClick={() => remove(row)} title={t('Delete')}>
                          <Icon.trash size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal
          title={modal.mode === 'create' ? t(addLabel) : t('Edit')}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>
                {t('Cancel')}
              </button>
              <button className="btn btn-primary" onClick={submit} disabled={saving}>
                {saving ? t('Saving...') : t('Save')}
              </button>
            </>
          }
        >
          {formError && <div className="error-banner">{t(formError)}</div>}
          {formFields.map((field) => (
            <div className="field" key={field.name}>
              <label htmlFor={field.name}>{t(field.label)}</label>
              {field.readOnly ? (
                <input id={field.name} type="text" value={values[field.name] ?? ''} disabled readOnly />
              ) : field.type === 'date' ? (
                <DateField
                  id={field.name}
                  value={values[field.name] ?? ''}
                  onChange={(v) => updateField(field.name, v)}
                  required={field.required}
                />
              ) : field.type === 'select' ? (
                <select id={field.name} value={values[field.name] ?? ''} onChange={(e) => updateField(field.name, e.target.value)}>
                  <option value="" disabled>
                    {t('Select...')}
                  </option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.label)}
                    </option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea id={field.name} rows={3} value={values[field.name] ?? ''} onChange={(e) => updateField(field.name, e.target.value)} />
              ) : (
                <input
                  id={field.name}
                  type={field.type === 'number' ? field.type : 'text'}
                  value={values[field.name] ?? ''}
                  onChange={(e) => updateField(field.name, e.target.value)}
                  required={field.required}
                />
              )}
            </div>
          ))}
        </Modal>
      )}
    </>
  );
}

/**
 * Standalone page for a simple lookup/CRUD module (Locations, Cargo
 * Types, Customers, Suppliers, ...): CrudPanel wrapped in AppShell, with
 * a page header (icon + title + description) above the toolbar.
 * Modules with real extra behavior (Trucks' assignments, Invoices' ZATCA
 * flow, HR's multi-tab layout) build their own page, using CrudPanel
 * directly inside their own AppShell instead of this.
 */
export function CrudPage<T extends { id: number }>({ title, description, ...panelProps }: CrudPageProps<T>) {
  // filterBar/onValuesChange flow through panelProps already (CrudPanelProps superset)
  const t = useT();
  return (
    <AppShell title={title}>
      <div className="page-header">
        <h2>{t(title)}</h2>
        {description && <p>{t(description)}</p>}
      </div>
      <CrudPanel<T> {...panelProps} exportTitle={title} />
    </AppShell>
  );
}
