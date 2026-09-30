'use client';

import { ReactNode, useEffect, useState } from 'react';
import { AppShell } from './AppShell';
import { Modal } from './Modal';
import type { RpcError } from '../lib/grpc/client';

export interface ColumnDef<T> {
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
}

interface CrudPageProps<T extends { id: number }> {
  title: string;
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
}

export interface FormFieldDef {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'textarea';
  options?: { value: string; label: string }[];
  required?: boolean;
}

/**
 * Generic list+create+edit+delete page shared by every simple lookup/CRUD
 * module (Locations, Cargo Types, Customers, Suppliers, ...). Modules with
 * real extra behavior (Trucks' assignments, Invoices' ZATCA flow, HR's
 * multi-tab layout) build their own page instead of using this.
 */
export function CrudPage<T extends { id: number }>({
  title,
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
}: CrudPageProps<T>) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; row?: T } | null>(null);
  const [values, setValues] = useState<Record<string, string>>(emptyValues);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    fetchAll()
      .then(setRows)
      .catch((err) => setError((err as RpcError).message ?? 'Failed to load data.'));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!confirm('Delete this record? This cannot be undone.')) return;
    try {
      await onDelete(row.id);
      load();
    } catch (err) {
      setError((err as RpcError).message ?? 'Delete failed.');
    }
  }

  return (
    <AppShell title={title}>
      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <div />
        <button className="btn btn-primary" onClick={openCreate}>
          + {addLabel}
        </button>
      </div>

      <div className="panel">
        {rows === null ? (
          <div className="empty-state">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">{emptyLabel}</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.header} style={{ textAlign: col.align ?? 'left' }}>
                    {col.header}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((col) => (
                    <td key={col.header} style={{ textAlign: col.align ?? 'left' }}>
                      {col.render(row)}
                    </td>
                  ))}
                  <td>
                    <div className="row-actions">
                      <button className="row-action" onClick={() => openEdit(row)}>
                        Edit
                      </button>
                      <button className="row-action danger" onClick={() => remove(row)}>
                        Delete
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
          title={modal.mode === 'create' ? addLabel : 'Edit'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={submit} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          }
        >
          {formError && <div className="error-banner">{formError}</div>}
          {formFields.map((field) => (
            <div className="field" key={field.name}>
              <label htmlFor={field.name}>{field.label}</label>
              {field.type === 'select' ? (
                <select
                  id={field.name}
                  value={values[field.name] ?? ''}
                  onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
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
                  onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                />
              ) : (
                <input
                  id={field.name}
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={values[field.name] ?? ''}
                  onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                  required={field.required}
                />
              )}
            </div>
          ))}
        </Modal>
      )}
    </AppShell>
  );
}
