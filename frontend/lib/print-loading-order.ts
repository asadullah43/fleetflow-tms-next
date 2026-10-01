import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
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

const PAGE_STYLE = `
  * { box-sizing: border-box; }
  .pdf-page {
    width: 210mm;
    height: 297mm;
    padding: 10mm;
    background: #ffffff;
    font-family: 'Segoe UI', -apple-system, system-ui, Roboto, sans-serif;
    color: #171b26;
    display: flex;
    flex-direction: column;
  }
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
    background: #e8743d;
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
  .doc-type { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #e8743d; margin-bottom: 4px; }
  .serial { font-family: 'Courier New', monospace; font-size: 20px; font-weight: 700; letter-spacing: 0.02em; }
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
  .fields-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 20px; margin-bottom: 14px; }
  .field { border: 1px solid #e3e1d8; border-radius: 8px; padding: 9px 12px; background: #faf8f4; }
  .field-label { font-size: 9px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #8a8f9c; margin-bottom: 4px; }
  .field-value { font-size: 14px; font-weight: 700; }
  .fillins { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: auto; padding-top: 14px; }
  .fillin .field-label { margin-bottom: 6px; }
  .fillin-box { height: 30px; border: 1.5px dashed #b7bcc8; border-radius: 6px; }
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
`;

function pageHtml(order: LoadingOrderDto, company: CompanySettingsDto): string {
  return `
    <style>${PAGE_STYLE}</style>
    <div class="pdf-page">
      ${slip(order, company, 'Driver Copy')}
      <div class="cut-line"><span>cut here</span></div>
      ${slip(order, company, 'Warehouse Copy')}
    </div>
  `;
}

function waitForImages(root: HTMLElement): Promise<void[]> {
  const imgs = Array.from(root.querySelectorAll('img'));
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  );
}

/**
 * Renders one A4 page per loading order — a "Driver Copy" and "Warehouse
 * Copy" slip stacked on the same sheet with a cut line between them — into
 * an actual PDF (via an offscreen render + html2canvas + jsPDF, so Arabic/
 * non-Latin text and the uploaded logo render exactly as designed) and
 * opens it directly in a new tab. No print dialog in the flow — the
 * person can save/print from the browser's own PDF viewer if they want to.
 */
export async function printLoadingOrders(orders: LoadingOrderDto[], company: CompanySettingsDto): Promise<void> {
  if (orders.length === 0) return;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-10000px';
  container.style.zIndex = '-1';
  document.body.appendChild(container);

  try {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const title = orders.length === 1 ? orders[0].serialNumber : `${orders[0].serialNumber}_to_${orders[orders.length - 1].serialNumber}`;
    doc.setProperties({ title });
    let first = true;

    for (const order of orders) {
      container.innerHTML = pageHtml(order, company);
      const pageEl = container.querySelector<HTMLElement>('.pdf-page');
      if (!pageEl) continue;
      await waitForImages(pageEl);
      const canvas = await html2canvas(pageEl, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      if (!first) doc.addPage('a4', 'portrait');
      first = false;
      doc.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    }

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
  } finally {
    document.body.removeChild(container);
  }
}
