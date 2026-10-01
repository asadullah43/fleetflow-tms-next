/**
 * ZATCA Phase-1 ("Fatoora") QR code: a base64 TLV (tag-length-value)
 * payload encoding seller name, VAT number, invoice timestamp, total
 * (with VAT), and VAT amount — this part of the spec is simple and needs
 * no government-issued certificate, so it's a real implementation, unlike
 * the Phase-2 cryptographic stamp (see invoices.service.ts's comment).
 */

/** TLV lengths are a single byte, so each value can be at most 255 bytes of UTF-8. */
const MAX_TLV_VALUE_BYTES = 255;

export function buildZatcaQrTlv(fields: {
  sellerName: string;
  vatNumber: string;
  timestampIso: string;
  totalWithVat: string;
  vatAmount: string;
}): string {
  const tags: [number, string][] = [
    [1, fields.sellerName],
    [2, fields.vatNumber],
    [3, fields.timestampIso],
    [4, fields.totalWithVat],
    [5, fields.vatAmount],
  ];

  const chunks: Buffer[] = tags.map(([tag, value]) => {
    const valueBuf = Buffer.from(value, 'utf8');
    // Previously an over-long value (e.g. a long Arabic seller name) wrapped
    // its length byte (300 -> 44) and silently produced a corrupt QR.
    if (valueBuf.length > MAX_TLV_VALUE_BYTES) {
      throw new Error(`ZATCA QR tag ${tag} is ${valueBuf.length} bytes; the maximum is ${MAX_TLV_VALUE_BYTES}`);
    }
    return Buffer.concat([Buffer.from([tag, valueBuf.length]), valueBuf]);
  });

  return Buffer.concat(chunks).toString('base64');
}

/** ISO-8601 UTC timestamp without milliseconds (e.g. 2026-10-01T14:30:00Z), the form ZATCA's samples use. */
export function zatcaTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
