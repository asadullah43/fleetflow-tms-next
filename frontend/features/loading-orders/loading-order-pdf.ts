import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { DocumentCompanyDto, LoadingOrderDocumentDto, LoadingOrderDto } from '../../lib/api/loading-orders.api';
import { formatDocumentDate } from '../../lib/date';
import type { Language } from '../../lib/language-context';
import { localizedJoinedName } from '../../lib/localized-name';

const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Only image data the app itself produced (the logo is stored as a data: URI) is ever placed in the document. */
const safeLogo = (logoUrl: string | undefined) => (logoUrl && /^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(logoUrl) ? logoUrl : null);

function field(label: string, value: string): string {
  return `<div class="field"><div class="field-label">${esc(label)}</div><div class="field-value">${esc(value)}</div></div>`;
}

function slip(order: LoadingOrderDto, company: DocumentCompanyDto, copyLabel: string, language: Language): string {
  const logo = safeLogo(company.logoUrl);
  const name = (en: string | undefined, ar: string | undefined) => localizedJoinedName(en, ar, language) || '—';
  const identity = [company.crNumber && `CR ${company.crNumber}`, company.vatNumber && `VAT ${company.vatNumber}`].filter(Boolean) as string[];
  const contact = [company.phone, company.email, [company.address, company.city].filter(Boolean).join(', ')].filter(Boolean) as string[];
  return `
    <section class="slip">
      <header class="slip-header">
        <div class="brand">
          ${logo ? `<img src="${logo}" class="logo" alt="" />` : '<div class="logo logo-placeholder"></div>'}
          <div class="brand-text">
            <div class="company-name">${esc(company.companyName)}</div>
            <div class="company-contact">${contact.map(esc).join(' &nbsp;&middot;&nbsp; ')}</div>
            ${identity.length ? `<div class="company-contact">${identity.map(esc).join(' &nbsp;&middot;&nbsp; ')}</div>` : ''}
          </div>
        </div>
        <div class="doc-id">
          <div class="doc-type">Loading Order</div>
          <div class="serial">${esc(order.serialNumber)}</div>
          <div class="doc-date">${esc(formatDocumentDate(order.createdAt))}</div>
        </div>
      </header>

      <div class="copy-chip">${esc(copyLabel)}</div>

      <div class="fields-grid">
        ${field('Pickup Location', name(order.pickupLocationName, order.pickupLocationNameAr))}
        ${field('Delivery Location', name(order.deliveryLocationName, order.deliveryLocationNameAr))}
        ${field('Customer', name(order.customerName, order.customerNameAr))}
        ${field('Cargo Type', name(order.cargoTypeName, order.cargoTypeNameAr))}
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
        <span>Issued ${esc(formatDocumentDate(order.createdAt))}</span>
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

function pageHtml(order: LoadingOrderDto, company: DocumentCompanyDto, language: Language): string {
  return `
    <style>${PAGE_STYLE}</style>
    <div class="pdf-page">
      ${slip(order, company, 'Driver Copy', language)}
      <div class="cut-line"><span>cut here</span></div>
      ${slip(order, company, 'Warehouse Copy', language)}
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

/** A4 portrait, in millimetres. */
const A4 = { width: 210, height: 297 };

/**
 * Builds the Loading Order PDF from the backend's document payload — the
 * slips and the company identity exactly as the server holds them — and
 * returns it as a Blob. One A4 page per order: a "Driver Copy" and a
 * "Warehouse Copy" with a cut line between them.
 *
 * Each page is laid out as HTML off-screen and rasterized (html2canvas)
 * before being placed in the PDF, so Arabic names and the uploaded logo
 * come out exactly as designed, whatever fonts the PDF viewer has.
 */
export async function buildLoadingOrderPdf(documentData: LoadingOrderDocumentDto, language: Language): Promise<{ blob: Blob; title: string } | null> {
  const { orders, company } = documentData;
  if (orders.length === 0) return null;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-10000px';
  container.style.zIndex = '-1';
  container.setAttribute('aria-hidden', 'true');
  document.body.appendChild(container);

  try {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const title = orders.length === 1 ? orders[0].serialNumber : `${orders[0].serialNumber}_to_${orders[orders.length - 1].serialNumber}`;
    pdf.setProperties({ title, author: company.companyName, subject: 'Loading Order' });

    for (const [index, order] of orders.entries()) {
      container.innerHTML = pageHtml(order, company, language);
      const page = container.querySelector<HTMLElement>('.pdf-page');
      if (!page) continue;
      await waitForImages(page);
      const canvas = await html2canvas(page, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      if (index > 0) pdf.addPage('a4', 'portrait');
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, A4.width, A4.height);
    }
    return { blob: pdf.output('blob'), title };
  } finally {
    document.body.removeChild(container);
  }
}
