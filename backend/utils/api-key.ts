import crypto from 'node:crypto';

const PREFIX = 'ffk_';

/** A new random API key: returns the plaintext (shown to the user once) plus what gets stored. */
export function generateApiKey(): { plaintext: string; keyPrefix: string; keyHash: string } {
  const plaintext = PREFIX + crypto.randomBytes(32).toString('base64url');
  return { plaintext, keyPrefix: plaintext.slice(0, 12), keyHash: hashApiKey(plaintext) };
}

/** Keys are high-entropy random strings, so a fast SHA-256 (not bcrypt) is the right stored form and allows lookup by hash. */
export function hashApiKey(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}
