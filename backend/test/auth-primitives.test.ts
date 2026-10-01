import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'unit-test-secret';
const { signJwt, verifyJwt } = await import('../src/lib/jwt.js');
const { LoginThrottle } = await import('../src/modules/auth/login-throttle.js');

test('JWT round-trip keeps the payload this app signs', () => {
  const token = signJwt({ sub: 7, email: 'a@b.c', roleId: 3 });
  const payload = verifyJwt(token);
  assert.equal(payload.sub, 7);
  assert.equal(payload.email, 'a@b.c');
  assert.equal(payload.roleId, 3);
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

test('login throttle blocks after N failures within the window, per username, case-insensitively', () => {
  let now = 0;
  const throttle = new LoginThrottle(3, 1000, () => now);
  for (let i = 0; i < 3; i++) throttle.recordFailure('Admin');
  assert.equal(throttle.isBlocked('admin'), true);
  assert.equal(throttle.isBlocked('someone-else'), false);
  now = 1001; // window passed
  assert.equal(throttle.isBlocked('admin'), false);
});

test('login throttle: success clears the failure count', () => {
  const throttle = new LoginThrottle(2, 1000, () => 0);
  throttle.recordFailure('u');
  throttle.recordSuccess('u');
  throttle.recordFailure('u');
  assert.equal(throttle.isBlocked('u'), false);
});
