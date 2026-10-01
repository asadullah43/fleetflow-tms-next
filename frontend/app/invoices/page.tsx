'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { Modal } from '../../components/Modal';
import { DateField } from '../../components/DateField';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../lib/auth-context';
import { useT, useLanguage } from '../../lib/language-context';
import { localizedName, localizedJoinedName } from '../../lib/localized-name';
import { invoicesClient, InvoiceDto, InvoiceLineItemDto } from '../../lib/grpc/invoices';
import { customersClient } from '../../lib/grpc/customers';
import type { RpcError } from '../../lib/grpc/client';

function emptyLine(): InvoiceLineItemDto {
  return { description: '', quantity: '1', rate: '0' };
}

export default function InvoicesPage() {
  const { token } = useAuth();
  const t = useT();
  const { language } = useLanguage();
  const [invoices, setInvoices] = useState<InvoiceDto[] | null>(null);
  const [customers, setCustomers] = useState<{ value: string; label: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: 'create' | 'view'; invoice?: InvoiceDto } | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [vatEnabled, setVatEnabled] = useState(true);
  const [lines, setLines] = useState<InvoiceLineItemDto[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    if (!token) return;
    Promise.all([invoicesClient.list(token), customersClient.list(token)])
      .then(([inv, cust]) => {
        setInvoices(inv);
        setCustomers(cust.map((c) => ({ value: String(c.id), label: localizedName(c, language) })));
      })
      .catch((err) => setError((err as RpcError).message ?? 'Failed to load invoices.'));
  }

  useEffect(load, [token, language]);

  function openCreate() {
    setCustomerId('');
    setDueDate('');
    setFromDate('');
    setToDate('');
    setVatEnabled(true);
    setLines([emptyLine()]);
    setFormError(null);
    setModal({ mode: 'create' });
  }

  function openView(invoice: InvoiceDto) {
    setModal({ mode: 'view', invoice });
  }

  const subtotal = lines.reduce((sum, l) => sum + Number(l.quantity || 0) * Number(l.rate || 0), 0);
  const vatAmount = vatEnabled ? subtotal * 0.15 : 0;

  async function submit() {
    setSaving(true);
    setFormError(null);
    try {
      await invoicesClient.create(
        {
          customerId: Number(customerId),
          dueDate,
          fromDate,
          toDate,
          vatEnabled,
          lineItems: lines.filter((l) => l.description),
        } as any,
        token!,
      );
      setModal(null);
      load();
    } catch (err) {
      setFormError((err as RpcError).message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(invoice: InvoiceDto) {
    try {
      await invoicesClient.markPaid(invoice.id, token!);
      load();
      setModal(null);
    } catch (err) {
      setError((err as RpcError).message ?? 'Failed to mark as paid.');
    }
  }

  async function submitToZatca(invoice: InvoiceDto) {
    try {
      const updated = await invoicesClient.submitToZatca(invoice.id, token!);
      load();
      setModal({ mode: 'view', invoice: updated });
    } catch (err) {
      setError((err as RpcError).message ?? 'ZATCA submission failed.');
    }
  }

  async function remove(invoice: InvoiceDto) {
    if (!confirm(`Delete invoice ${invoice.invoiceNumber}?`)) return;
    try {
      await invoicesClient.remove(invoice.id, token!);
      load();
    } catch (err) {
      setError((err as RpcError).message ?? 'Delete failed.');
    }
  }

  return (
    <AppShell title="Invoices">
      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <div />
        <button className="btn btn-primary" onClick={openCreate} disabled={!customers}>
          {t('+ Invoice')}
        </button>
      </div>

      <div className="panel">
        {invoices === null ? (
          <div className="empty-state">{t('Loading...')}</div>
        ) : invoices.length === 0 ? (
          <div className="empty-state">{t('No invoices yet.')}</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('Invoice #')}</th>
                <th>{t('Customer')}</th>
                <th>{t('Due')}</th>
                <th style={{ textAlign: 'right' }}>{t('Total')}</th>
                <th>{t('Status')}</th>
                <th>{t('ZATCA')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <button className="row-action" onClick={() => openView(inv)}>
                      <span className="mono">{inv.invoiceNumber}</span>
                    </button>
                  </td>
                  <td>{localizedJoinedName(inv.customerName, inv.customerNameAr, language) ?? inv.customerId}</td>
                  <td>{inv.dueDate?.slice(0, 10)}</td>
                  <td style={{ textAlign: 'right' }} className="mono">
                    {inv.total} {inv.currency}
                  </td>
                  <td>
                    <StatusBadge status={inv.status} />
                  </td>
                  <td>
                    <StatusBadge status={inv.zatcaStatus ?? 'PENDING_SIGN'} />
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="row-action danger" onClick={() => remove(inv)}>
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

      {modal?.mode === 'create' && customers && (
        <Modal
          title={t('New invoice')}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>
                {t('Cancel')}
              </button>
              <button className="btn btn-primary" onClick={submit} disabled={saving}>
                {saving ? t('Saving...') : t('Create invoice')}
              </button>
            </>
          }
        >
          {formError && <div className="error-banner">{formError}</div>}
          <div className="field">
            <label>{t('Customer')}</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="" disabled>
                {t('Select...')}
              </option>
              {customers.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>{t('From date')}</label>
              <DateField value={fromDate} onChange={setFromDate} />
            </div>
            <div className="field">
              <label>{t('To date')}</label>
              <DateField value={toDate} onChange={setToDate} />
            </div>
            <div className="field">
              <label>{t('Due date')}</label>
              <DateField value={dueDate} onChange={setDueDate} />
            </div>
          </div>
          <div className="field">
            <label>
              <input type="checkbox" checked={vatEnabled} onChange={(e) => setVatEnabled(e.target.checked)} style={{ width: 'auto', marginRight: 8 }} />
              {t('Apply 15% VAT')}
            </label>
          </div>

          <div className="field">
            <label>{t('Line items')}</label>
            {lines.map((line, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                <input
                  placeholder={t('Description')}
                  value={line.description}
                  onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, description: e.target.value } : l)))}
                />
                <input
                  placeholder={t('Qty')}
                  value={line.quantity}
                  onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, quantity: e.target.value } : l)))}
                />
                <input
                  placeholder={t('Rate')}
                  value={line.rate}
                  onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, rate: e.target.value } : l)))}
                />
                <button className="btn btn-secondary" onClick={() => setLines(lines.filter((_, j) => j !== i))} type="button">
                  ×
                </button>
              </div>
            ))}
            <button className="btn btn-secondary" type="button" onClick={() => setLines([...lines, emptyLine()])}>
              {t('+ Add line')}
            </button>
          </div>

          <div style={{ textAlign: 'right', fontSize: 13.5, color: 'var(--text-muted)' }}>
            {t('Subtotal:')} {subtotal.toFixed(2)} SAR
            {vatEnabled && (
              <>
                {' '}
                · {t('VAT:')} {vatAmount.toFixed(2)} SAR
              </>
            )}
            <div style={{ fontWeight: 600, color: 'var(--text)', marginTop: 4 }}>
              {t('Total:')} {(subtotal + vatAmount).toFixed(2)} SAR
            </div>
          </div>
        </Modal>
      )}

      {modal?.mode === 'view' && modal.invoice && (
        <Modal
          title={`Invoice ${modal.invoice.invoiceNumber}`}
          onClose={() => setModal(null)}
          footer={
            <>
              {modal.invoice.status !== 'PAID' && (
                <button className="btn btn-secondary" onClick={() => markPaid(modal.invoice!)}>
                  {t('Mark as paid')}
                </button>
              )}
              {(!modal.invoice.zatcaStatus || modal.invoice.zatcaStatus === 'PENDING_SIGN') && (
                <button className="btn btn-primary" onClick={() => submitToZatca(modal.invoice!)}>
                  {t('Submit to ZATCA')}
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setModal(null)}>
                {t('Close')}
              </button>
            </>
          }
        >
          <div style={{ marginBottom: 16 }}>
            <div>
              {t('Customer:')} {localizedJoinedName(modal.invoice.customerName, modal.invoice.customerNameAr, language) ?? modal.invoice.customerId}
            </div>
            <div>
              {t('Due:')} {modal.invoice.dueDate?.slice(0, 10)}
            </div>
            <div>
              {t('Status:')} <StatusBadge status={modal.invoice.status} /> &nbsp; {t('ZATCA:')}{' '}
              <StatusBadge status={modal.invoice.zatcaStatus ?? 'PENDING_SIGN'} />
            </div>
          </div>
          <table className="data-table" style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                <th>{t('Description')}</th>
                <th style={{ textAlign: 'right' }}>{t('Qty')}</th>
                <th style={{ textAlign: 'right' }}>{t('Rate')}</th>
                <th style={{ textAlign: 'right' }}>{t('Amount')}</th>
              </tr>
            </thead>
            <tbody>
              {modal.invoice.lineItems.map((li, i) => (
                <tr key={i}>
                  <td>{li.description}</td>
                  <td style={{ textAlign: 'right' }}>{li.quantity}</td>
                  <td style={{ textAlign: 'right' }}>{li.rate}</td>
                  <td style={{ textAlign: 'right' }}>{li.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ textAlign: 'right' }}>
            <div>
              {t('Subtotal:')} {modal.invoice.subtotal}
            </div>
            <div>
              {t('VAT:')} {modal.invoice.vatAmount}
            </div>
            <div style={{ fontWeight: 600 }}>
              {t('Total:')} {modal.invoice.total} {modal.invoice.currency}
            </div>
          </div>
          {modal.invoice.qrCode && (
            <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
              {t('ZATCA QR (base64 TLV):')} {modal.invoice.qrCode}
            </div>
          )}
        </Modal>
      )}
    </AppShell>
  );
}
