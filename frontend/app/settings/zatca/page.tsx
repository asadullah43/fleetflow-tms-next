'use client';

import { AppShell } from '../../../components/AppShell';

export default function ZatcaSettingsPage() {
  return (
    <AppShell title="ZATCA e-Invoicing">
      <div className="panel" style={{ padding: 24, maxWidth: 640 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Phase-1 QR codes are live</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.6 }}>
          Every invoice gets a real ZATCA-compliant QR code (seller name, VAT number, timestamp, total,
          and VAT amount, TLV-encoded) when you use <strong>Submit to ZATCA</strong> on the Invoices page.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.6 }}>
          Phase-2 integration — the cryptographic invoice stamp and live clearance/reporting calls to
          ZATCA&apos;s API — needs a government-issued CSR and CSID certificate for your CR number, which
          this environment has no way to request or test against. The database is ready for it
          (see the company settings record&apos;s onboarding fields), so wiring in real certificates
          later is a config change, not a rebuild.
        </p>
      </div>
    </AppShell>
  );
}
