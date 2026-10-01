'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { AppShell } from '../../../components/AppShell';
import { useAuth, usePagePermissions } from '../../../lib/auth-context';
import { useT } from '../../../lib/language-context';
import { companySettingsClient, CompanySettingsDto } from '../../../lib/grpc/company-settings';
import { setCompanyBranding } from '../../../lib/use-company-branding';
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

const MAX_LOGO_DIMENSION = 240;

/** Resizes/compresses an uploaded image client-side (no backend upload
 *  endpoint exists — the logo is stored as a data URI in logoUrl, so
 *  keeping it small matters for both the DB row and the gRPC message
 *  size cap). Returns a PNG data URI no larger than 240x240. */
function fileToLogoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a readable image.'));
      img.onload = () => {
        const scale = Math.min(1, MAX_LOGO_DIMENSION / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not process that image.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function CompanySettingsPage() {
  const { token } = useAuth();
  const t = useT();
  const allowed = usePagePermissions();
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoError, setLogoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    companySettingsClient.get(token).then((row) => {
      const v: Record<string, string> = {};
      for (const f of FIELDS) v[f.name] = (row[f.name] as string) ?? '';
      setValues(v);
      setLogoUrl(row.logoUrl ?? '');
    });
  }, [token]);

  async function onLogoSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoError(t('Please choose an image file.'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoError(t('That image is larger than 5 MB — choose a smaller file.'));
      return;
    }
    setLogoError(null);
    try {
      const dataUrl = await fileToLogoDataUrl(file);
      setLogoUrl(dataUrl);
    } catch (err) {
      setLogoError((err as Error).message ?? t('Could not process that image.'));
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const saved = await companySettingsClient.update({ ...values!, logoUrl }, token!);
      setSavedAt(Date.now());
      setCompanyBranding({ companyName: saved.companyName, logoUrl: saved.logoUrl });
    } catch (err) {
      setError((err as RpcError).message ?? t('Save failed.'));
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
      {error && <div className="error-banner">{t(error)}</div>}
      <div className="panel" style={{ padding: 24, maxWidth: 640 }}>
        <div className="field">
          <label>{t('Company logo')}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={t('Company logo')} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>{t('No logo')}</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                  {logoUrl ? t('Replace logo') : t('Upload logo')}
                </button>
                {logoUrl && (
                  <button type="button" className="btn btn-secondary" onClick={() => setLogoUrl('')}>
                    {t('Remove')}
                  </button>
                )}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{t('PNG or JPG. Shown in the sidebar, login screen, and printed documents.')}</span>
              {logoError && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{logoError}</span>}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onLogoSelected} />
          </div>
        </div>

        {FIELDS.map((f) => (
          <div className="field" key={f.name}>
            <label>{t(f.label)}</label>
            <input value={values[f.name] ?? ''} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving || !allowed.edit}>
            {saving ? t('Saving...') : t('Save changes')}
          </button>
          {savedAt && <span style={{ color: 'var(--success)', fontSize: 13 }}>{t('Saved.')}</span>}
        </div>
      </div>
    </AppShell>
  );
}
