'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../lib/auth-context';
import { useT } from '../../lib/language-context';
import { rolesClient, RoleDto, PermissionDto } from '../../lib/grpc/roles';
import type { RpcError } from '../../lib/grpc/client';

function emptyPermissions(modules: string[]): PermissionDto[] {
  return modules.map((module) => ({ module, canView: false, canAdd: false, canEdit: false, canDelete: false }));
}

function formatModule(module: string): string {
  const spaced = module.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export default function RolesPage() {
  const { token } = useAuth();
  const t = useT();
  const [modules, setModules] = useState<string[] | null>(null);
  const [roles, setRoles] = useState<RoleDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; role?: RoleDto } | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<PermissionDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    if (!token) return;
    Promise.all([rolesClient.getPermissionModules(token), rolesClient.list(token)])
      .then(([mods, list]) => {
        setModules(mods);
        setRoles(list);
      })
      .catch((err) => setError((err as RpcError).message ?? 'Failed to load roles.'));
  }

  useEffect(load, [token]);

  function openCreate() {
    setName('');
    setDescription('');
    setPermissions(emptyPermissions(modules ?? []));
    setFormError(null);
    setModal({ mode: 'create' });
  }

  function openEdit(role: RoleDto) {
    setName(role.name);
    setDescription(role.description ?? '');
    const byModule = new Map(role.permissions.map((p) => [p.module, p]));
    setPermissions((modules ?? []).map((m) => byModule.get(m) ?? { module: m, canView: false, canAdd: false, canEdit: false, canDelete: false }));
    setFormError(null);
    setModal({ mode: 'edit', role });
  }

  function togglePerm(module: string, field: keyof Omit<PermissionDto, 'module'>) {
    setPermissions((prev) => prev.map((p) => (p.module === module ? { ...p, [field]: !p[field] } : p)));
  }

  async function submit() {
    setSaving(true);
    setFormError(null);
    try {
      if (modal?.mode === 'edit' && modal.role) {
        await rolesClient.update(modal.role.id, { name, description, permissions }, token!);
      } else {
        await rolesClient.create({ name, description, permissions }, token!);
      }
      setModal(null);
      load();
    } catch (err) {
      setFormError((err as RpcError).message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(role: RoleDto) {
    if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    try {
      await rolesClient.remove(role.id, token!);
      load();
    } catch (err) {
      setError((err as RpcError).message ?? 'Delete failed.');
    }
  }

  return (
    <AppShell title="Roles">
      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <div />
        <button className="btn btn-primary" onClick={openCreate}>
          {t('+ Role')}
        </button>
      </div>

      <div className="panel">
        {roles === null ? (
          <div className="empty-state">{t('Loading...')}</div>
        ) : roles.length === 0 ? (
          <div className="empty-state">{t('No roles yet.')}</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('Name')}</th>
                <th>{t('Description')}</th>
                <th>{t('Modules with access')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id}>
                  <td>{role.name}</td>
                  <td>{role.description ?? '—'}</td>
                  <td>{role.permissions.filter((p) => p.canView).length} of {role.permissions.length}</td>
                  <td>
                    <div className="row-actions">
                      <button className="row-action" onClick={() => openEdit(role)}>
                        {t('Edit')}
                      </button>
                      <button className="row-action danger" onClick={() => remove(role)}>
                        {t('Delete')}
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
          title={modal.mode === 'create' ? t('Add role') : `${t('Edit')} ${modal.role?.name}`}
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
          {formError && <div className="error-banner">{formError}</div>}
          <div className="field">
            <label>{t('Role name')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>{t('Description')}</label>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field">
            <label>{t('Permissions')}</label>
            <table className="data-table" style={{ fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th>{t('Module')}</th>
                  <th style={{ textAlign: 'center' }}>{t('View')}</th>
                  <th style={{ textAlign: 'center' }}>{t('Add')}</th>
                  <th style={{ textAlign: 'center' }}>{t('Edit')}</th>
                  <th style={{ textAlign: 'center' }}>{t('Delete')}</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((p) => (
                  <tr key={p.module}>
                    <td>{t(formatModule(p.module))}</td>
                    {(['canView', 'canAdd', 'canEdit', 'canDelete'] as const).map((field) => (
                      <td key={field} style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={p[field]} onChange={() => togglePerm(p.module, field)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
