'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { PageLoading } from '../../components/PageLoading';
import { Icon } from '../../components/icons';
import { useAuth, usePagePermissions } from '../../lib/auth-context';
import { useLookups } from '../../lib/use-lookups';
import { useLanguage, useT } from '../../lib/language-context';
import { localizedName, localizedJoinedName } from '../../lib/localized-name';
import { loadingOrdersClient, LoadingOrderBatchDto } from '../../lib/grpc/loading-orders';
import { locationsClient } from '../../lib/grpc/locations';
import { customersClient } from '../../lib/grpc/customers';
import { cargoTypesClient } from '../../lib/grpc/cargo-types';
import { companySettingsClient } from '../../lib/grpc/company-settings';
import { printLoadingOrders } from '../../lib/print-loading-order';
import type { RpcError } from '../../lib/grpc/client';

type Opt = { value: string; label: string }[];

const MAX_QUANTITY = 200;

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Opt; onChange: (value: string) => void }) {
  const t = useT();
  return (
    <div className="field" style={{ margin: 0 }}>
      <label>{t(label)}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>
          {t('Select...')}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Matches the legacy app: "Generate" creates N individually-serialled
 * slips (LO-0001, LO-0002, ...) sharing one batch and immediately opens
 * them as a PDF in a new tab (Driver Copy + Warehouse Copy per order) — no
 * print dialog in the flow. The list shows one row per batch — there's no
 * per-row edit, only re-opening the PDF or deleting the whole batch.
 */
export default function LoadingOrdersPage() {
  const { token } = useAuth();
  const { language } = useLanguage();
  const t = useT();
  const allowed = usePagePermissions();
  const [batches, setBatches] = useState<LoadingOrderBatchDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pickupLocationId, setPickupLocationId] = useState('');
  const [deliveryLocationId, setDeliveryLocationId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [cargoTypeId, setCargoTypeId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [generating, setGenerating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [openingBatchId, setOpeningBatchId] = useState<number | null>(null);

  const { data: opts, error: lookupError } = useLookups<{ locations: Opt; customers: Opt; cargoTypes: Opt }>(
    async (token) => {
      const [locations, customers, cargoTypes] = await Promise.all([
        locationsClient.list(token),
        customersClient.list(token),
        cargoTypesClient.list(token),
      ]);
      return {
        locations: locations.map((l) => ({ value: String(l.id), label: localizedName(l, language) })),
        customers: customers.map((c) => ({ value: String(c.id), label: localizedName(c, language) })),
        cargoTypes: cargoTypes.map((c) => ({ value: String(c.id), label: localizedName(c, language) })),
      };
    },
    [language],
  );

  function loadBatches() {
    if (!token) return;
    loadingOrdersClient
      .listGrouped(token)
      .then((rows) => {
        setBatches(rows);
        setError(null);
      })
      .catch((err) => {
        setError((err as RpcError).message || t('Failed to load loading orders.'));
        setBatches((prev) => prev ?? []);
      });
  }

  useEffect(loadBatches, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate() {
    setFormError(null);
    const qty = Number(quantity);
    if (!pickupLocationId || !deliveryLocationId || !customerId || !cargoTypeId) {
      setFormError(t('Pickup, delivery, customer, and cargo type are all required.'));
      return;
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QUANTITY) {
      setFormError(t('Quantity must be a whole number between 1 and 200.'));
      return;
    }

    setGenerating(true);
    try {
      const [orders, company] = await Promise.all([
        loadingOrdersClient.create(
          {
            pickupLocationId: Number(pickupLocationId),
            deliveryLocationId: Number(deliveryLocationId),
            customerId: Number(customerId),
            cargoTypeId: Number(cargoTypeId),
            quantity: qty,
          },
          token!,
        ),
        companySettingsClient.get(token!),
      ]);
      await printLoadingOrders(orders, company);
      setPickupLocationId('');
      setDeliveryLocationId('');
      setCustomerId('');
      setCargoTypeId('');
      setQuantity('1');
      loadBatches();
    } catch (err) {
      setFormError((err as RpcError).message || t('Unable to generate loading orders.'));
    } finally {
      setGenerating(false);
    }
  }

  async function handleReprint(batch: LoadingOrderBatchDto) {
    setOpeningBatchId(batch.batchId);
    try {
      const [orders, company] = await Promise.all([loadingOrdersClient.getBatch(batch.batchId, token!), companySettingsClient.get(token!)]);
      await printLoadingOrders(orders, company);
    } catch (err) {
      setError((err as RpcError).message || t('Unable to open this batch as a PDF.'));
    } finally {
      setOpeningBatchId(null);
    }
  }

  async function handleDelete(batch: LoadingOrderBatchDto) {
    const range = batch.quantity > 1 ? `${batch.firstSerialNumber} - ${batch.lastSerialNumber}` : batch.firstSerialNumber;
    if (!confirm(`${t('Delete loading order batch')} ${range}? ${t('This cannot be undone.')}`)) return;
    try {
      await loadingOrdersClient.removeBatch(batch.batchId, token!);
      loadBatches();
    } catch (err) {
      setError((err as RpcError).message || t('Delete failed.'));
    }
  }

  if (!opts || !batches) return <PageLoading title="Loading Orders" error={lookupError} />;

  return (
    <AppShell title="Loading Orders">
      <div className="page-header">
        <h2>{t('Loading Orders')}</h2>
        <p>{t('Generate loading order slips (Driver & Warehouse copies) for a route — the PDF opens in a new tab, ready to print or save.')}</p>
      </div>

      {allowed.add && (
        <div className="panel" style={{ padding: 20, marginBottom: 20 }}>
          {formError && <div className="error-banner">{t(formError)}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, alignItems: 'end' }}>
            <SelectField label="Pickup location" value={pickupLocationId} options={opts.locations} onChange={setPickupLocationId} />
            <SelectField label="Delivery location" value={deliveryLocationId} options={opts.locations} onChange={setDeliveryLocationId} />
            <SelectField label="Customer" value={customerId} options={opts.customers} onChange={setCustomerId} />
            <SelectField label="Cargo type" value={cargoTypeId} options={opts.cargoTypes} onChange={setCargoTypeId} />
            <div className="field" style={{ margin: 0 }}>
              <label>{t('Quantity')}</label>
              <input type="number" min={1} max={MAX_QUANTITY} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={handleGenerate} disabled={generating}>
            <Icon.plus size={15} /> {generating ? t('Generating...') : t('Generate loading order')}
          </button>
        </div>
      )}

      {error && <div className="error-banner">{t(error)}</div>}

      <div className="panel">
        {batches.length === 0 ? (
          <div className="empty-state">{t('No loading orders yet — generate your first batch above.')}</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('Loading order #')}</th>
                <th>{t('Pickup')}</th>
                <th>{t('Delivery')}</th>
                <th>{t('Customer')}</th>
                <th>{t('Cargo')}</th>
                <th style={{ textAlign: 'right' }}>{t('Qty')}</th>
                <th>{t('Generated on')}</th>
                <th style={{ textAlign: 'right' }}>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.batchId}>
                  <td className="mono">{b.quantity > 1 ? `${b.firstSerialNumber} - ${b.lastSerialNumber}` : b.firstSerialNumber}</td>
                  <td>{localizedJoinedName(b.pickupLocationName, b.pickupLocationNameAr, language)}</td>
                  <td>{localizedJoinedName(b.deliveryLocationName, b.deliveryLocationNameAr, language)}</td>
                  <td>{localizedJoinedName(b.customerName, b.customerNameAr, language)}</td>
                  <td>{localizedJoinedName(b.cargoTypeName, b.cargoTypeNameAr, language)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{b.quantity}</td>
                  <td>{new Date(b.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB')}</td>
                  <td>
                    <div className="row-actions">
                      <button className="row-action" onClick={() => handleReprint(b)} disabled={openingBatchId === b.batchId} title={t('Open PDF')}>
                        <Icon.fileText size={16} />
                      </button>
                      {allowed.delete && (
                        <button className="row-action danger" onClick={() => handleDelete(b)} title={t('Delete batch')}>
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
    </AppShell>
  );
}
