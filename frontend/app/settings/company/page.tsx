'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../../components/AppShell';
import { useAuth } from '../../../lib/auth-context';
import { companySettingsClient, CompanySettingsDto } from '../../../lib/grpc/company-settings';
import type { RpcError } from '../../../lib/grpc/client';

const FIELDS: { name: keyof CompanySettingsDto; label: string }[] = [
  { name: 'companyName', label: 'Company name' },
  { name: 'vatNumber', label: 'VAT number' },
  { name: 'crNumber', label: 'CR number' },
  { name: 'branchName', label: 'Branch name' },
  { name: 'industryCategory', label: 'Industry category' },
  { name: 'city', label: 'City' },
  { name: 'country', label: 'Country' },
  { name: 'address', label: 'Address' },
  { name: 'streetName', label: 'Street name' },
  { name: 'buildingNumber', label: 'Building number' },
  { name: 'postalCode', label: 'Postal code' },
  { name: 'bankName', label: 'Bank name' },
  { name: 'bankAccount', label: 'Bank account (IBAN)' },
  { name: 'phone', label: 'Phone' },
  { name: 'email', label: 'Email' },
];

export default function CompanySettingsPage() {
  const { token } = useAuth();
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    companySettingsClient.get(token).then((row) => {
      const v: Record<string, string> = {};
      for (const f of FIELDS) v[f.name] = (row[f.name] as string) ?? '';
      setValues(v);
    });
  }, [token]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await companySettingsClient.update(values!, token!);
      setSavedAt(Date.now());
    } catch (err) {
      setError((err as RpcError).message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  if (!values) {
    return (
      <AppShell title="Company Settings">
        <div className="empty-state">Loading...</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Company Settings">
      {error && <div className="error-banner">{error}</div>}
      <div className="panel" style={{ padding: 24, maxWidth: 640 }}>
        {FIELDS.map((f) => (
          <div className="field" key={f.name}>
            <label>{f.label}</label>
            <input
              value={values[f.name] ?? ''}
              onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
            />
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          {savedAt && <span style={{ color: 'var(--success)', fontSize: 13 }}>Saved.</span>}
        </div>
      </div>
    </AppShell>
  );
}
