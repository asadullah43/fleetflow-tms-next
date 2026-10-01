'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { Icon } from '../../components/icons';
import { useAuth } from '../../lib/auth-context';
import { useLanguage } from '../../lib/language-context';
import { localizedName, localizedJoinedName } from '../../lib/localized-name';
import { loadingOrdersClient, LoadingOrderBatchDto } from '../../lib/grpc/loading-orders';
import { locationsClient } from '../../lib/grpc/locations';
import { customersClient } from '../../lib/grpc/customers';
import { cargoTypesClient } from '../../lib/grpc/cargo-types';
import { companySettingsClient } from '../../lib/grpc/company-settings';
import { printLoadingOrders } from '../../lib/print-loading-order';
import type { RpcError } from '../../lib/grpc/client';

type Opt = { value: string; label: string }[];

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
  const [opts, setOpts] = useState<{ locations: Opt; customers: Opt; cargoTypes: Opt } | null>(null);
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

  function loadBatches() {
    if (!token) return;
    loadingOrdersClient
      .listGrouped(token)
      .then(setBatches)
      .catch((err) => setError((err as RpcError).message ?? 'Failed to load loading orders.'));
  }

  useEffect(() => {
    if (!token) return;
    Promise.all([locationsClient.list(token), customersClient.list(token), cargoTypesClient.list(token)]).then(
      ([locations, customers, cargoTypes]) => {
        setOpts({
          locations: locations.map((l) => ({ value: String(l.id), label: localizedName(l, language) })),
          customers: customers.map((c) => ({ value: String(c.id), label: localizedName(c, language) })),
          cargoTypes: cargoTypes.map((c) => ({ value: String(c.id), label: localizedName(c, language) })),
        });
      },
    );
    loadBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, language]);

  async function handleGenerate() {
    setFormError(null);
    const qty = Number(quantity);
    if (!pickupLocationId || !deliveryLocationId || !customerId || !cargoTypeId) {
      setFormError('Pickup, delivery, customer, and cargo type are all required.');
      return;
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 200) {
      setFormError('Quantity must be a whole number between 1 and 200.');
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
      setFormError((err as RpcError).message ?? 'Unable to generate loading orders.');
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
      setError((err as RpcError).message ?? 'Unable to open this batch as a PDF.');
    } finally {
      setOpeningBatchId(null);
    }
  }

  async function handleDelete(batch: LoadingOrderBatchDto) {
    if (!confirm(`Delete loading order batch ${batch.firstSerialNumber}${batch.quantity > 1 ? ` - ${batch.lastSerialNumber}` : ''}? This cannot be undone.`)) return;
    try {
      await loadingOrdersClient.removeBatch(batch.batchId, token!);
      loadBatches();
    } catch (err) {
      setError((err as RpcError).message ?? 'Delete failed.');
    }
  }

  if (!opts || !batches) {
    return (
      <AppShell title="Loading Orders">
        <div className="empty-state">Loading...</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Loading Orders">
      <div className="page-header">
        <h2>Loading Orders</h2>
        <p>Generate loading order slips (Driver &amp; Warehouse copies) for a route — the PDF opens in a new tab, ready to print or save.</p>
      </div>

      <div className="panel" style={{ padding: 20, marginBottom: 20 }}>
        {formError && <div className="error-banner">{formError}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, alignItems: 'end' }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Pickup location</label>
            <select value={pickupLocationId} onChange={(e) => setPickupLocationId(e.target.value)}>
              <option value="" disabled>
                Select...
              </option>
              {opts.locations.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Delivery location</label>
            <select value={deliveryLocationId} onChange={(e) => setDeliveryLocationId(e.target.value)}>
              <option value="" disabled>
                Select...
              </option>
              {opts.locations.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Customer</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="" disabled>
                Select...
              </option>
              {opts.customers.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Cargo type</label>
            <select value={cargoTypeId} onChange={(e) => setCargoTypeId(e.target.value)}>
              <option value="" disabled>
                Select...
              </option>
              {opts.cargoTypes.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Quantity</label>
            <input type="number" min={1} max={200} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={handleGenerate} disabled={generating}>
          <Icon.plus size={15} /> {generating ? 'Generating...' : 'Generate loading order'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel">
        {batches.length === 0 ? (
          <div className="empty-state">No loading orders yet — generate your first batch above.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Loading order #</th>
                <th>Pickup</th>
                <th>Delivery</th>
                <th>Customer</th>
                <th>Cargo</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th>Generated on</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
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
                  <td>{new Date(b.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="row-action"
                        onClick={() => handleReprint(b)}
                        disabled={openingBatchId === b.batchId}
                        title="Open PDF"
                      >
                        <Icon.fileText size={16} />
                      </button>
                      <button className="row-action danger" onClick={() => handleDelete(b)} title="Delete batch">
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
    </AppShell>
  );
}
