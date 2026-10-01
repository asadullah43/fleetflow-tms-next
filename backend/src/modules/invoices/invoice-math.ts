/**
 * Invoice line and total arithmetic, done in integer cents.
 *
 * The previous version multiplied and summed JavaScript floats and let
 * the database round each column independently, so a stored total could
 * differ by a halala from subtotal + VAT, and a line's VAT from its
 * share of the invoice VAT. Here every line amount and line VAT is
 * rounded once (half-up, to 2 decimals), and the invoice totals are
 * exact sums of those rounded values, so the stored figures always add
 * up, which ZATCA validation expects.
 */

export interface LineItemInput {
  description: string;
  quantity: string;
  rate: string;
  taxCategory?: string;
  taxPercent?: string;
}

export interface ComputedLine {
  description: string;
  quantity: string;
  rate: string;
  amount: string;
  taxCategory: string;
  taxPercent: string;
  taxAmount: string;
}

export interface ComputedInvoice {
  rows: ComputedLine[];
  subtotal: string;
  vatAmount: string;
  total: string;
}

/** Largest value a Decimal(12,2) money column holds, in cents (9,999,999,999.99). */
const MAX_MONEY_CENTS = 999_999_999_999;

/** Thrown for input the caller must fix; the service maps it to a 400. */
export class InvoiceInputError extends Error {}

/** Parses a non-negative decimal string into an integer number of 1/10^places units, rejecting anything else. */
function toUnits(value: string | number | undefined, places: number): number {
  const text = String(value ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(text)) throw new InvoiceInputError(`Not a valid amount: "${text}"`);
  const [whole, frac = ''] = text.split('.');
  // Round half-up on the first dropped digit.
  const kept = frac.slice(0, places).padEnd(places, '0');
  const roundUp = frac.length > places && Number(frac[places]) >= 5 ? 1 : 0;
  return Number(whole) * 10 ** places + Number(kept) + roundUp;
}

/** a * b / denominator for non-negative integers, rounded half-up. BigInt so large quantities × rates can't lose precision. */
function mulDivRound(a: number, b: number, denominator: number): number {
  const d = BigInt(denominator);
  return Number((BigInt(a) * BigInt(b) + d / 2n) / d);
}

function formatUnits(units: number, places: number): string {
  const sign = units < 0 ? '-' : '';
  const abs = Math.abs(units);
  const scale = 10 ** places;
  const whole = Math.floor(abs / scale);
  const frac = String(abs % scale).padStart(places, '0');
  return `${sign}${whole}.${frac}`;
}

export function computeInvoice(items: LineItemInput[], vatEnabled: boolean, defaultVatPercent: string | number): ComputedInvoice {
  let subtotalCents = 0;
  let vatCents = 0;

  const rows = items.map((item) => {
    if (!item.description?.trim()) throw new InvoiceInputError('Line item description is required');
    const qtyMilli = toUnits(item.quantity, 3); // quantity: up to 3 decimals
    const rateCents = toUnits(item.rate, 2); // money: 2 decimals
    if (qtyMilli <= 0) throw new InvoiceInputError('Line item quantity must be above zero');

    const taxBasisPoints = toUnits(item.taxPercent?.trim() ? item.taxPercent : vatEnabled ? defaultVatPercent : 0, 2); // 15% -> 1500
    if (taxBasisPoints > 10_000) throw new InvoiceInputError('Tax percent cannot exceed 100');

    const amountCents = mulDivRound(qtyMilli, rateCents, 1000);
    const taxCents = vatEnabled ? mulDivRound(amountCents, taxBasisPoints, 10_000) : 0;
    subtotalCents += amountCents;
    vatCents += taxCents;
    if (amountCents > MAX_MONEY_CENTS || subtotalCents + vatCents > MAX_MONEY_CENTS) {
      throw new InvoiceInputError('Amount is larger than an invoice can hold');
    }

    return {
      description: item.description.trim(),
      quantity: formatUnits(qtyMilli, 3),
      rate: formatUnits(rateCents, 2),
      amount: formatUnits(amountCents, 2),
      taxCategory: item.taxCategory || 'S',
      taxPercent: formatUnits(taxBasisPoints, 2),
      taxAmount: formatUnits(taxCents, 2),
    };
  });

  return {
    rows,
    subtotal: formatUnits(subtotalCents, 2),
    vatAmount: formatUnits(vatCents, 2),
    total: formatUnits(subtotalCents + vatCents, 2),
  };
}
