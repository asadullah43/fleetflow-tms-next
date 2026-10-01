'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { AppShell } from './AppShell';
import { Modal } from './Modal';
import { Icon } from './icons';
import { cellText, exportCsv, printTable } from '../lib/export-table';
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
}: CrudPanelProps<T> & { exportTitle?: string }) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit' | 'view'; row?: T } | null>(null);
  const [values, setValues] = useState<Record<string, string>>(emptyValues);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  function load() {
    fetchAll()
      .then(setRows)
      .catch((err) => setError((err as RpcError).message ?? 'Failed to load data.'));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasActiveFilters = filterBar ? Object.values(filters).some((v) => v) : false;

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

  function openView(row: T) {
    setValues(toFormValues(row));
    setFormError(null);
    setModal({ mode: 'view', row });
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
    if (!confirm('Delete this record? This cannot be undone.')) return;
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
      {error && <div className="error-banner">{error}</div>}

      {filterBar && (
        <div className="filter-bar">
          {filterBar.fields.map((f) =>
            f.type === 'date' ? (
              <div className="search-field filter-field" key={f.name}>
                <Icon.calendar size={15} />
                <input
                  type="date"
                  placeholder={f.label}
                  aria-label={f.label}
                  value={filters[f.name] ?? ''}
                  onChange={(e) => setFilters({ ...filters, [f.name]: e.target.value })}
                />
              </div>
            ) : (
              <div className="search-field filter-field" key={f.name}>
                <Icon.search size={15} />
                <input
                  placeholder={f.label}
                  value={filters[f.name] ?? ''}
                  onChange={(e) => setFilters({ ...filters, [f.name]: e.target.value })}
                />
              </div>
            )
          )}
          {hasActiveFilters && (
            <button type="button" className="btn btn-secondary" onClick={() => setFilters({})}>
              Clear filters
            </button>
          )}
        </div>
      )}

      <div className="toolbar">
        <div className="field" style={{ margin: 0, maxWidth: 280, flex: 1 }}>
          <div className="search-field">
            <Icon.search size={15} />
            <input
              placeholder={searchPlaceholder ?? 'Search...'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-excel" onClick={() => exportRows('csv')} type="button">
            <Icon.gridLayers size={15} /> Excel
          </button>
          <button className="btn btn-secondary" onClick={() => exportRows('pdf')} type="button">
            <Icon.fileText size={15} /> PDF
          </button>
          <button className="btn btn-primary" onClick={openCreate} type="button">
            <Icon.plus size={15} /> {addLabel}
          </button>
        </div>
      </div>

      <div className="panel">
        {visibleRows === null ? (
          <div className="empty-state">Loading...</div>
        ) : visibleRows.length === 0 ? (
          <div className="empty-state">{rows && rows.length > 0 ? 'No matching records.' : emptyLabel}</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.header} style={{ textAlign: col.align ?? 'left' }}>
                    {col.header}
                  </th>
                ))}
                <th style={{ textAlign: 'right' }}>Actions</th>
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
                      <button className="row-action" onClick={() => openView(row)} title="View">
                        <Icon.eye size={16} />
                      </button>
                      <button className="row-action" onClick={() => openEdit(row)} title="Edit">
                        <Icon.pencil size={16} />
                      </button>
                      <button className="row-action danger" onClick={() => remove(row)} title="Delete">
                        <Icon.trash size={16} />
                      </button>
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
          title={modal.mode === 'create' ? addLabel : modal.mode === 'view' ? 'View' : 'Edit'}
          onClose={() => setModal(null)}
          footer={
            modal.mode === 'view' ? (
              <button className="btn btn-secondary" onClick={() => setModal(null)}>
                Close
              </button>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={() => setModal(null)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={submit} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            )
          }
        >
          {formError && <div className="error-banner">{formError}</div>}
          {formFields.map((field) => (
            <div className="field" key={field.name}>
              <label htmlFor={field.name}>{field.label}</label>
              {field.readOnly ? (
                <input id={field.name} type="text" value={values[field.name] ?? ''} disabled readOnly />
              ) : field.type === 'select' ? (
                <select
                  id={field.name}
                  value={values[field.name] ?? ''}
                  onChange={(e) => updateField(field.name, e.target.value)}
                  disabled={modal.mode === 'view'}
                >
                  <option value="" disabled>
                    Select...
                  </option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  id={field.name}
                  rows={3}
                  value={values[field.name] ?? ''}
                  onChange={(e) => updateField(field.name, e.target.value)}
                  disabled={modal.mode === 'view'}
                />
              ) : (
                <input
                  id={field.name}
                  type={field.type === 'number' || field.type === 'date' ? field.type : 'text'}
                  value={values[field.name] ?? ''}
                  onChange={(e) => updateField(field.name, e.target.value)}
                  required={field.required}
                  disabled={modal.mode === 'view'}
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
  return (
    <AppShell title={title}>
      <div className="page-header">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      <CrudPanel<T> {...panelProps} exportTitle={title} />
    </AppShell>
  );
}
