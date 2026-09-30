import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';

// No live database or account is used: preflights stop at the CORS middleware.
process.env.NODE_ENV = 'production';
process.env.ALLOWED_ORIGINS = 'https://custom.example/';
process.env.JWT_SECRET = 'cors-regression-test-only';
delete process.env.DATABASE_URL;
process.env.ALLOW_DB_FALLBACK = 'false';
const app = require('../app').default;
let server: Server;
let base: string;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

async function preflight(origin: string) {
  return fetch(`${base}/api/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
}

test('production desktop/web login accepts the shipped frontend with a stale hosting allowlist', async () => {
  const response = await preflight('https://my-buildx.vercel.app');
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://my-buildx.vercel.app');
  assert.match(response.headers.get('access-control-allow-methods') || '', /POST/);
  assert.match(response.headers.get('access-control-allow-headers') || '', /Content-Type/i);
});

test('configured frontend URLs accept their browser origin without a trailing slash', async () => {
  const response = await preflight('https://custom.example');
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://custom.example');
});

test('lookalike and opaque origins do not receive cross-origin access', async () => {
  for (const origin of ['https://my-buildx.vercel.app.evil.example', 'null']) {
    const response = await preflight(origin);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.notEqual(response.status, 204);
  }
});
