import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'unit-test-secret';
const { signJwt, verifyJwt } = await import('../utils/jwt.js');
const { generateApiKey, hashApiKey } = await import('../utils/api-key.js');
const { config } = await import('../global_config/index.js');

test('JWT round-trip keeps the payload this app signs', () => {
  const token = signJwt({ sub: 7, email: 'a@b.c', roleId: 3, companyId: 2 });
  const payload = verifyJwt(token);
  assert.equal(payload.sub, 7);
  assert.equal(payload.email, 'a@b.c');
  assert.equal(payload.roleId, 3);
  assert.equal(payload.companyId, 2);
});

test('JWT signed with a different secret is rejected', () => {
  const forged = jwt.sign({ sub: 1, email: 'x', roleId: 1 }, 'some-other-secret');
  assert.throws(() => verifyJwt(forged));
});

test('JWT using another algorithm is rejected even with the right secret', () => {
  const hs512 = jwt.sign({ sub: 1, email: 'x', roleId: 1 }, 'unit-test-secret', { algorithm: 'HS512' });
  assert.throws(() => verifyJwt(hs512));
  const unsigned = jwt.sign({ sub: 1 }, '', { algorithm: 'none' } as jwt.SignOptions);
  assert.throws(() => verifyJwt(unsigned));
});

test('JWT that is expired is rejected', () => {
  const expired = jwt.sign({ sub: 1, email: 'x', roleId: 1, exp: Math.floor(Date.now() / 1000) - 10 }, 'unit-test-secret');
  assert.throws(() => verifyJwt(expired), /expired/);
});

test('validly signed JWT with the wrong shape is rejected', () => {
  const weird = jwt.sign({ sub: 'admin' }, 'unit-test-secret');
  assert.throws(() => verifyJwt(weird), /Malformed/);
});

test('sessions last 12 hours by default and the expiry is inside the signed token', () => {
  assert.equal(config.auth.sessionDuration, '12h');
  const { iat, exp } = jwt.decode(signJwt({ sub: 1, email: 'x', roleId: null, companyId: 1 })) as { iat: number; exp: number };
  assert.equal(exp - iat, 12 * 60 * 60);
});

test('a token is rejected the moment its 12 hours are up', () => {
  const issuedAt = Math.floor(Date.now() / 1000) - 12 * 60 * 60 - 1;
  const stale = jwt.sign({ sub: 1, email: 'x', roleId: 1, companyId: 1, iat: issuedAt }, 'unit-test-secret', { expiresIn: '12h' });
  assert.throws(() => verifyJwt(stale), /expired/);
});

test('API keys are random, prefixed, and stored only as a SHA-256 hash', () => {
  const a = generateApiKey();
  const b = generateApiKey();
  assert.notEqual(a.plaintext, b.plaintext);
  assert.match(a.plaintext, /^ffk_[A-Za-z0-9_-]{43}$/);
  assert.equal(a.keyHash, hashApiKey(a.plaintext));
  assert.match(a.keyHash, /^[0-9a-f]{64}$/);
  assert.ok(a.plaintext.startsWith(a.keyPrefix) && a.keyPrefix.length < a.plaintext.length / 2);
  assert.ok(!a.keyHash.includes(a.plaintext));
});
