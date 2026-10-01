'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '../../../components/AppShell';
import { Modal } from '../../../components/Modal';
import { StatusBadge } from '../../../components/StatusBadge';
import { Icon } from '../../../components/icons';
import { DateField } from '../../../components/DateField';
import { useAuth } from '../../../lib/auth-context';
import { useT, useLanguage } from '../../../lib/language-context';
import { localizedName, localizedJoinedName } from '../../../lib/localized-name';
import { trucksClient, TruckDto } from '../../../lib/grpc/trucks';
import { driversClient, DriverDto } from '../../../lib/grpc/drivers';
import { assignmentsClient, AssignmentDto } from '../../../lib/grpc/assignments';
import { assignmentState, STATE_LABEL, STATE_TONE } from '../../../lib/assignment-state';
import type { RpcError } from '../../../lib/grpc/client';

export default function TruckDetailPage() {
  const params = useParams<{ id: string }>();
  const truckId = Number(params.id);
  const { token } = useAuth();
  const t = useT();
  const { language } = useLanguage();

  const [truck, setTruck] = useState<TruckDto | null>(null);
  const [drivers, setDrivers] = useState<DriverDto[]>([]);
  const [assignments, setAssignments] = useState<AssignmentDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ driverId: '', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<AssignmentDto | null>(null);
  const [editForm, setEditForm] = useState({ driverId: '', startDate: '', endDate: '' });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  function load() {
    if (!token) return;
    Promise.all([trucksClient.get(truckId, token), driversClient.list(token), assignmentsClient.list(token)])
      .then(([t, d, a]) => {
        setTruck(t);
        setDrivers(d);
        setAssignments(a.filter((x) => x.truckId === truckId));
      })
      .catch((err) => setError((err as RpcError).message ?? 'Failed to load truck.'));
  }

  useEffect(load, [token, truckId]);

  const history = useMemo(() => {
    if (!assignments) return [];
    return [...assignments].sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [assignments]);

  const current = useMemo(() => history.find((a) => assignmentState(a) === 'active') ?? null, [history]);

  const driverOptions = drivers.map((d) => ({ value: String(d.id), label: localizedName(d, language) }));

  async function assignDriver() {
    if (!token) return;
    setSaving(true);
    setFormError(null);
    try {
      await assignmentsClient.create(
        { truckId, driverId: Number(form.driverId), startDate: form.startDate, endDate: form.endDate || undefined },
        token,
      );
      setForm({ driverId: '', startDate: '', endDate: '' });
      load();
    } catch (err) {
      setFormError((err as RpcError).message ?? 'Could not save assignment.');
    } finally {
      setSaving(false);
    }
  }

  function openEdit(a: AssignmentDto) {
    setEditForm({ driverId: String(a.driverId), startDate: a.startDate.slice(0, 10), endDate: a.endDate?.slice(0, 10) ?? '' });
    setEditError(null);
    setEditModal(a);
  }

  async function saveEdit() {
    if (!token || !editModal) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await assignmentsClient.update(
        editModal.id,
        { driverId: Number(editForm.driverId), startDate: editForm.startDate, endDate: editForm.endDate || undefined },
        token,
      );
      setEditModal(null);
      load();
    } catch (err) {
      setEditError((err as RpcError).message ?? 'Could not save changes.');
    } finally {
      setEditSaving(false);
    }
  }

  async function unassign(a: AssignmentDto) {
    if (!token) return;
    if (!confirm(`Remove this assignment for ${localizedJoinedName(a.driverName, a.driverNameAr, language) ?? 'this driver'}? This cannot be undone.`)) return;
    try {
      await assignmentsClient.remove(a.id, token);
      load();
    } catch (err) {
      setError((err as RpcError).message ?? 'Could not remove assignment.');
    }
  }

  if (error) {
    return (
      <AppShell title="Truck">
        <div className="error-banner">{error}</div>
      </AppShell>
    );
  }

  if (!truck || !assignments) {
    return (
      <AppShell title="Truck">
        <div className="empty-state">Loading...</div>
      </AppShell>
    );
  }

  return (
    <AppShell title={truck.truckNumber}>
      <Link href="/trucks" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, textDecoration: 'none' }}>
        {t('← Back to Trucks')}
      </Link>

      {/* Hero */}
      <div
        className="panel"
        style={{
          background: 'linear-gradient(135deg, #0f1420 0%, #161d2c 55%, #1b2335 100%)',
          color: '#fff',
          border: 'none',
          padding: 26,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon.truck size={26} />
            </span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{truck.truckNumber}</div>
              {truck.truckType && <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>{truck.truckType}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            <HeroStat label={t('Current driver')} value={(current && localizedJoinedName(current.driverName, current.driverNameAr, language)) ?? t('Unassigned')} />
            <HeroStat label={t('Assignment history')} value={String(history.length)} />
            <HeroStat label={t('Status')} value={<StatusBadge status={truck.status} />} />
          </div>
        </div>
      </div>

      <div className="dash-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Current driver card */}
          {current ? (
            <div className="panel" style={{ padding: 20, borderColor: 'var(--success)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span className="stat-icon stat-icon-green" style={{ width: 44, height: 44 }}>
                  <Icon.driver size={20} />
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15.5 }}>{localizedJoinedName(current.driverName, current.driverNameAr, language)}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                    {t('Current since')} {current.startDate.slice(0, 10)}
                    {!current.endDate && <> · {t('Ongoing')}</>}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="panel empty-state">{t('No driver currently assigned.')}</div>
          )}

          {/* Assign driver form */}
          <div className="panel" style={{ padding: 20 }}>
            <h3 className="dash-panel-title">{t('Assign a driver')}</h3>
            <p className="dash-panel-sub">{t('Start a new assignment for this truck.')}</p>
            {formError && <div className="error-banner">{formError}</div>}
            <div className="field">
              <label>{t('Driver')}</label>
              <select value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })}>
                <option value="" disabled>
                  {t('Select...')}
                </option>
                {driverOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('Start date')}</label>
              <DateField value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} />
            </div>
            <div className="field">
              <label>{t('End date (leave blank if ongoing)')}</label>
              <DateField value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} />
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={saving || !form.driverId || !form.startDate}
              onClick={assignDriver}
            >
              {saving ? t('Saving...') : t('Assign driver')}
            </button>
          </div>
        </div>

        <div className="panel" style={{ padding: 20 }}>
          <h3 className="dash-panel-title">{t('Assignment history')}</h3>
          <p className="dash-panel-sub">{t('Every driver this truck has been assigned to, most recent first.')}</p>
          {history.length === 0 ? (
            <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>{t('No assignments yet.')}</div>
          ) : (
            <div>
              {history.map((a, i) => {
                const state = assignmentState(a);
                return (
                  <div key={a.id} style={{ display: 'flex', gap: 14 }}>
                    <div style={{ width: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          marginTop: 6,
                          background: `var(--tile-${STATE_TONE[state]}-fg)`,
                          boxShadow: `0 0 0 3px var(--tile-${STATE_TONE[state]}-bg)`,
                          flexShrink: 0,
                        }}
                      />
                      {i < history.length - 1 && <span style={{ flex: 1, width: 2, background: 'var(--border-subtle)', marginTop: 2 }} />}
                    </div>
                    <div style={{ paddingBottom: 20, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{localizedJoinedName(a.driverName, a.driverNameAr, language) ?? `Driver #${a.driverId}`}</div>
                        <span className={`badge badge-${state === 'active' ? 'success' : state === 'upcoming' ? 'warning' : 'neutral'}`}>
                          {t(STATE_LABEL[state])}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        {a.startDate.slice(0, 10)} → {a.endDate ? a.endDate.slice(0, 10) : t('Ongoing')}
                      </div>
                      <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                        <button className="row-action" onClick={() => openEdit(a)} title={t('Edit')}>
                          <Icon.pencil size={14} /> {t('Edit')}
                        </button>
                        <button className="row-action danger" onClick={() => unassign(a)} title={t('Remove')}>
                          <Icon.trash size={14} /> {t('Remove')}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Truck details */}
      <div className="panel" style={{ padding: 20 }}>
        <h3 className="dash-panel-title">{t('Truck details')}</h3>
        <div className="stat-grid" style={{ marginTop: 14, marginBottom: 0 }}>
          <InfoTile label={t('Truck number')} value={truck.truckNumber} />
          <InfoTile label={t('Type')} value={truck.truckType || '—'} />
          <InfoTile label={t('Status')} value={<StatusBadge status={truck.status} />} />
          <InfoTile label={t('Assignment history')} value={String(history.length)} />
        </div>
      </div>

      {editModal && (
        <Modal
          title={t('Edit assignment')}
          onClose={() => setEditModal(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setEditModal(null)}>
                {t('Cancel')}
              </button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={editSaving}>
                {editSaving ? t('Saving...') : t('Save')}
              </button>
            </>
          }
        >
          {editError && <div className="error-banner">{editError}</div>}
          <div className="field">
            <label>{t('Driver')}</label>
            <select value={editForm.driverId} onChange={(e) => setEditForm({ ...editForm, driverId: e.target.value })}>
              {driverOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t('Start date')}</label>
            <DateField value={editForm.startDate} onChange={(v) => setEditForm({ ...editForm, startDate: v })} />
          </div>
          <div className="field">
            <label>{t('End date (leave blank if ongoing)')}</label>
            <DateField value={editForm.endDate} onChange={(v) => setEditForm({ ...editForm, endDate: v })} />
          </div>
        </Modal>
      )}
    </AppShell>
  );
}

function HeroStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.04, color: 'rgba(255,255,255,0.55)', marginBottom: 4, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface-raised)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
