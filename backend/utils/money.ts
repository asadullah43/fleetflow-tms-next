/**
 * Money as integer halalas (cents). Values arrive over gRPC as strings
 * ("150", "99.95"); summing them as floats and letting the database round
 * each column independently can leave a stored total a halala off from
 * its parts.
 */

/** "99.95" -> 9995. Returns null for anything that isn't a non-negative amount with at most 2 decimals. */
export function toCents(value: string | number | null | undefined): number | null {
  const text = String(value ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole, frac = ''] = text.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

/** 9995 -> "99.95" */
export function fromCents(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
