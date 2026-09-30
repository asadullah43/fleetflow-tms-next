/**
 * ZATCA Phase-1 ("Fatoora") QR code: a base64 TLV (tag-length-value)
 * payload encoding seller name, VAT number, invoice timestamp, total
 * (with VAT), and VAT amount — this part of the spec is simple and needs
 * no government-issued certificate, so it's a real implementation, unlike
 * the Phase-2 cryptographic stamp (see invoices.service.ts's comment).
 */
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
    return Buffer.concat([Buffer.from([tag, valueBuf.length]), valueBuf]);
  });

  return Buffer.concat(chunks).toString('base64');
}
