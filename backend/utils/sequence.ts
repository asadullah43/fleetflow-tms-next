/**
 * Human-readable running numbers (INV-2026-00042, WO-00007, EMP-00012).
 *
 * These used to be `count() + 1`, which breaks as soon as any record is
 * deleted: with 3 invoices and #1 deleted, count() is 2 so the next
 * number is ...00003 — already taken — and every create fails on the
 * unique constraint from then on. Instead the next value is one past the
 * numeric suffix of the most recently created record, and a concurrent
 * create that grabs the same value is retried.
 */

/** One past the trailing number in `lastValue` (or 1 when there's none), passed through `format`. */
export function nextInSequence(lastValue: string | null | undefined, format: (n: number) => string): string {
  const match = lastValue ? /(\d+)$/.exec(lastValue) : null;
  const last = match ? Number(match[1]) : 0;
  return format(last + 1);
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'P2002';
}

/**
 * Creates a record whose unique number comes from the sequence, retrying
 * with a fresh number if another request took the same one first.
 * `getLast` returns the newest record's number (highest id).
 */
export async function createWithSequence<T>(
  getLast: () => Promise<string | null | undefined>,
  format: (n: number) => string,
  create: (value: string) => Promise<T>,
  attempts = 5,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const value = nextInSequence(await getLast(), format);
    try {
      return await create(value);
    } catch (error) {
      if (!isUniqueViolation(error) || attempt >= attempts) throw error;
    }
  }
}
