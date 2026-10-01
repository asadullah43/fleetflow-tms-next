import type { LoadingOrderDto } from './grpc/loading-orders';
import type { CompanySettingsDto } from './grpc/company-settings';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
}

function field(label: string, value: string): string {
  return `<div class="field"><div class="field-label">${esc(label)}</div><div class="field-value">${esc(value)}</div></div>`;
}

function slip(order: LoadingOrderDto, company: CompanySettingsDto, copyLabel: string): string {
  return `
    <section class="slip">
      <header class="slip-header">
        <div class="brand">
          ${company.logoUrl ? `<img src="${esc(company.logoUrl)}" class="logo" alt="" />` : '<div class="logo logo-placeholder"></div>'}
          <div class="brand-text">
            <div class="company-name">${esc(company.companyName)}</div>
            <div class="company-contact">
              ${[company.phone, company.email].filter(Boolean).map((v) => esc(v as string)).join(' &nbsp;&middot;&nbsp; ')}
            </div>
          </div>
        </div>
        <div class="doc-id">
          <div class="doc-type">Loading Order</div>
          <div class="serial">${esc(order.serialNumber)}</div>
          <div class="doc-date">${esc(formatDate(order.createdAt))}</div>
        </div>
      </header>

      <div class="copy-chip">${esc(copyLabel)}</div>

      <div class="fields-grid">
        ${field('Pickup Location', order.pickupLocationName ?? '—')}
        ${field('Delivery Location', order.deliveryLocationName ?? '—')}
        ${field('Customer', order.customerName ?? '—')}
        ${field('Cargo Type', order.cargoTypeName ?? '—')}
      </div>

      <div class="fillins">
        <div class="fillin">
          <div class="field-label">Driver Name</div>
          <div class="fillin-box"></div>
        </div>
        <div class="fillin">
          <div class="field-label">Truck Number</div>
          <div class="fillin-box"></div>
        </div>
      </div>

      <footer class="slip-footer">
        <span>Issued ${esc(formatDate(order.createdAt))}</span>
        <span>Please sign and retain for records</span>
      </footer>
    </section>
  `;
}

/**
 * Prints one A4 page per loading order — a "Driver Copy" and "Warehouse
 * Copy" slip stacked on the same sheet with a cut line between them, each
 * carrying the route/customer/cargo and blank Driver/Truck fields to fill
 * by hand — built as a print-friendly page sized to A4 (browser's "Save
 * as PDF") instead of a PDF library.
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
          ${slip(order, company, 'Driver Copy')}
          <div class="cut-line"><span>&#9986; cut here</span></div>
          ${slip(order, company, 'Warehouse Copy')}
        </div>
      `,
    )
    .join('');

  win.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${esc(title)}</title>
        <style>
          @page { size: A4; margin: 10mm; }

          * { box-sizing: border-box; }

          html, body {
            margin: 0;
            font-family: 'Segoe UI', -apple-system, system-ui, Roboto, sans-serif;
            color: #171b26;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .page {
            display: flex;
            flex-direction: column;
            width: 190mm;
            min-height: 277mm;
            page-break-after: always;
          }
          .page:last-child { page-break-after: auto; }

          .slip {
            flex: 1 1 0;
            display: flex;
            flex-direction: column;
            border: 1.4px solid #d8dbe3;
            border-radius: 10px;
            padding: 9mm 10mm;
            position: relative;
            overflow: hidden;
          }
          .slip::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 5px;
            background: linear-gradient(90deg, #e8743d, #d4622e);
          }

          .slip-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            padding-top: 4px;
            border-bottom: 1.5px solid #171b26;
            padding-bottom: 10px;
            margin-bottom: 10px;
          }

          .brand { display: flex; align-items: center; gap: 12px; }
          .logo { width: 48px; height: 48px; object-fit: contain; border-radius: 8px; }
          .logo-placeholder { background: #f1f0eb; border: 1px solid #e3e1d8; }
          .brand-text { display: flex; flex-direction: column; gap: 3px; }
          .company-name { font-size: 18px; font-weight: 800; letter-spacing: -0.01em; }
          .company-contact { font-size: 10px; color: #6b7180; }

          .doc-id { text-align: right; flex-shrink: 0; }
          .doc-type {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #e8743d;
            margin-bottom: 4px;
          }
          .serial {
            font-family: 'Courier New', monospace;
            font-size: 20px;
            font-weight: 700;
            letter-spacing: 0.02em;
          }
          .doc-date { font-size: 10px; color: #6b7180; margin-top: 2px; }

          .copy-chip {
            align-self: flex-start;
            background: #171b26;
            color: #fff;
            font-size: 9.5px;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            padding: 4px 12px;
            border-radius: 999px;
            margin-bottom: 14px;
          }

          .fields-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px 20px;
            margin-bottom: 14px;
          }
          .field {
            border: 1px solid #e3e1d8;
            border-radius: 8px;
            padding: 9px 12px;
            background: #faf8f4;
          }
          .field-label {
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            color: #8a8f9c;
            margin-bottom: 4px;
          }
          .field-value { font-size: 14px; font-weight: 700; }

          .fillins {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: auto;
            padding-top: 14px;
          }
          .fillin .field-label { margin-bottom: 6px; }
          .fillin-box {
            height: 30px;
            border: 1.5px dashed #b7bcc8;
            border-radius: 6px;
          }

          .slip-footer {
            display: flex;
            justify-content: space-between;
            margin-top: 12px;
            padding-top: 8px;
            border-top: 1px solid #ece8de;
            font-size: 8.5px;
            color: #9ba0ad;
          }

          .cut-line {
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 5mm 0;
            height: 1px;
            background: repeating-linear-gradient(to right, #b0b0b0 0, #b0b0b0 5px, transparent 5px, transparent 10px);
            position: relative;
          }
          .cut-line span {
            position: absolute;
            background: #fff;
            padding: 0 10px;
            font-size: 9px;
            color: #9ba0ad;
            letter-spacing: 0.05em;
            text-transform: uppercase;
          }

          @media print {
            .page { min-height: 0; }
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
