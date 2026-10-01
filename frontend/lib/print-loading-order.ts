import type { LoadingOrderDto } from './grpc/loading-orders';
import type { CompanySettingsDto } from './grpc/company-settings';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
}

function copyBlock(order: LoadingOrderDto, company: CompanySettingsDto, copyLabel: string): string {
  return `
    <div class="copy">
      <div class="accent-bar"></div>
      <div class="head-row">
        <div class="company">
          <div class="copy-label">${esc(copyLabel.toUpperCase())}</div>
          <div class="company-row">
            ${company.logoUrl ? `<img src="${esc(company.logoUrl)}" class="logo" />` : ''}
            <div>
              <div class="company-name">${esc(company.companyName)}</div>
              ${company.phone ? `<div class="company-phone">${esc(company.phone)}</div>` : ''}
            </div>
          </div>
        </div>
        <div class="title-block">
          <div class="doc-title">Loading Order</div>
          <div class="doc-meta">${esc(order.serialNumber)} &middot; ${esc(formatDate(order.createdAt))}</div>
        </div>
      </div>
      <div class="fields-row">
        <div class="field-block"><div class="label">Pickup Location</div><div class="value">${esc(order.pickupLocationName ?? '-')}</div></div>
        <div class="field-block"><div class="label">Delivery Location</div><div class="value">${esc(order.deliveryLocationName ?? '-')}</div></div>
      </div>
      <div class="fields-row">
        <div class="field-block"><div class="label">Customer</div><div class="value">${esc(order.customerName ?? '-')}</div></div>
        <div class="field-block"><div class="label">Cargo Type</div><div class="value">${esc(order.cargoTypeName ?? '-')}</div></div>
      </div>
      <div class="fields-row">
        <div class="field-block blank"><div class="label">Driver</div><div class="line"></div></div>
        <div class="field-block blank"><div class="label">Truck Number</div><div class="line"></div></div>
      </div>
    </div>
  `;
}

/**
 * Prints one page per loading order — a "Driver Copy" and "Warehouse Copy"
 * slip, each with the route/customer/cargo and blank Driver/Truck fields
 * to fill by hand — same layout as the legacy app's PDF, built as a
 * print-friendly page (browser's "Save as PDF") instead of a PDF library.
 */
export function printLoadingOrders(orders: LoadingOrderDto[], company: CompanySettingsDto) {
  if (orders.length === 0) return;
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;

  const title =
    orders.length === 1 ? orders[0].serialNumber : `${orders[0].serialNumber}_to_${orders[orders.length - 1].serialNumber}`;

  const pages = orders
    .map(
      (order) => `
        <div class="page">
          ${copyBlock(order, company, 'Driver Copy')}
          <div class="dashed"></div>
          ${copyBlock(order, company, 'Warehouse Copy')}
        </div>
      `,
    )
    .join('');

  win.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${esc(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, system-ui, sans-serif; color: #10182b; margin: 0; }
          .page { padding: 24px; page-break-after: always; }
          .page:last-child { page-break-after: auto; }
          .copy { padding: 18px 4px; }
          .accent-bar { height: 3px; background: #d6336c; margin-bottom: 12px; }
          .head-row { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
          .copy-label { font-size: 9px; font-weight: 700; color: #d6336c; letter-spacing: 0.04em; margin-bottom: 6px; }
          .company-row { display: flex; align-items: center; gap: 8px; }
          .logo { width: 24px; height: 24px; object-fit: contain; }
          .company-name { font-size: 13px; font-weight: 700; }
          .company-phone { font-size: 9px; color: #6b7280; margin-top: 2px; }
          .title-block { text-align: right; }
          .doc-title { font-size: 14px; font-weight: 700; }
          .doc-meta { font-size: 9px; color: #5b6b79; margin-top: 4px; }
          .fields-row { display: flex; gap: 16px; margin-top: 10px; }
          .field-block { flex: 1; }
          .label { font-size: 8px; color: #5b6b79; margin-bottom: 2px; }
          .value { font-size: 11px; font-weight: 700; }
          .field-block.blank .line { height: 18px; border-bottom: 1px solid rgba(91,107,121,0.3); }
          .dashed { height: 1px; margin: 10px 0; background: repeating-linear-gradient(to right, #b0b0b0 0, #b0b0b0 4px, transparent 4px, transparent 8px); }
          @media print {
            .page { padding: 12px; }
          }
        </style>
      </head>
      <body>
        ${pages}
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}
