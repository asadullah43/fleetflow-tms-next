export interface DraftLine {
  description: string;
  quantity: string;
  rate: string;
}

export const DEFAULT_VAT_PERCENT = 15;

const toNumber = (text: string) => (/^\d+(\.\d+)?$/.test(text.trim()) ? Number(text) : 0);

/**
 * A live preview of the totals while typing. The authoritative,
 * cent-exact figures are computed by the backend when the invoice is
 * saved (backend/utils/invoice-math.ts) — what is stored may differ from
 * this preview by rounding of individual lines, never by more.
 */
export function previewTotals(lines: DraftLine[], vatEnabled: boolean): { subtotal: string; vat: string; total: string } {
  const subtotalCents = lines.reduce((sum, line) => sum + Math.round(toNumber(line.quantity) * toNumber(line.rate) * 100), 0);
  const vatCents = vatEnabled ? Math.round((subtotalCents * DEFAULT_VAT_PERCENT) / 100) : 0;
  const money = (cents: number) => (cents / 100).toFixed(2);
  return { subtotal: money(subtotalCents), vat: money(vatCents), total: money(subtotalCents + vatCents) };
}

/** Which draft lines are incomplete or invalid, by index. Blank trailing lines are ignored rather than flagged. */
export function lineProblems(lines: DraftLine[]): Record<number, string> {
  const problems: Record<number, string> = {};
  lines.forEach((line, index) => {
    const blank = !line.description.trim() && (line.quantity.trim() === '' || line.quantity.trim() === '1') && (line.rate.trim() === '' || line.rate.trim() === '0');
    if (blank) return;
    if (!line.description.trim()) problems[index] = 'Enter a description.';
    else if (!/^\d+(\.\d+)?$/.test(line.quantity.trim()) || Number(line.quantity) <= 0) problems[index] = 'Quantity must be above zero.';
    else if (!/^\d+(\.\d+)?$/.test(line.rate.trim())) problems[index] = 'Enter a number, e.g. 150 or 99.50.';
  });
  return problems;
}

export const filledLines = (lines: DraftLine[]) => lines.filter((line) => line.description.trim());
