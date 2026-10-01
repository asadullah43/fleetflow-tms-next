/** A fresh key identifying one user intent ("this press of Save"), sent as Idempotency-Key. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Non-secure contexts (plain http on a LAN address) lack randomUUID.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
