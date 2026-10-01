/**
 * Recursively converts a Prisma row into gRPC/protobuf-safe values:
 * Decimal -> string (arbitrary precision, no float rounding across the
 * wire), Date -> ISO string, nested objects/arrays walked the same way.
 */
export function serialize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    const maybeDecimal = value as { toNumber?: unknown; toFixed?: unknown; toString: () => string };
    if (typeof maybeDecimal.toNumber === 'function' && typeof maybeDecimal.toFixed === 'function') {
      return maybeDecimal.toString();
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = serialize(v);
    return out;
  }
  return value;
}
