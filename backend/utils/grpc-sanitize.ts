/**
 * @grpc/proto-loader is configured with `oneofs: true` (see server.ts) so
 * that explicit oneof groups decode cleanly. Side effect: proto3
 * `optional` fields are implemented under the hood as a synthetic
 * one-of-of-one, so every decoded request carries an extra presence
 * marker key per optional field — e.g. `optional string truck_type`
 * decodes not just to `truckType: "..."` but also `_truckType:
 * "truckType"`. Every generic and hand-written service in this backend
 * forwards `call.request` (whole or destructured) straight into Prisma's
 * `data`, and Prisma rejects those unrecognized `_xxx` keys outright
 * ("Unknown argument `_truckType`").
 *
 * Rather than patch every module, the router strips those synthetic keys
 * from every incoming request once, centrally (routes/router.ts).
 */
export function stripOneofMarkers<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(stripOneofMarkers) as unknown as T;
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Buffer) && !(value instanceof Date)) {
    const input = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(input)) {
      if (key.startsWith('_') && input[key] === key.slice(1) && key.slice(1) in input) {
        continue; // synthetic presence marker for an `optional` field — drop it
      }
      out[key] = stripOneofMarkers(input[key]);
    }
    return out as T;
  }
  return value;
}
