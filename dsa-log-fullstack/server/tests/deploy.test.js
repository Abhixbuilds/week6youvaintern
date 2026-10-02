/* Production-readiness checks: health, proxy-aware rate limiting, CORS, headers, hidden files, safe 500s, request logs. */
process.env.BCRYPT_ROUNDS = '4';
const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const request = require('supertest');
const { createDb } = require('../src/db');
const { createApp } = require('../src/app');

const clientDir = path.join(__dirname, '../../client');
const brokenDb = { prepare() { throw new Error('SQLITE_IOERR: disk I/O error (internal detail)'); } };
const quiet = () => mock.method(console, 'error', () => {});

test('health check reports ok with uptime when the database answers', async () => {
  const app = createApp(createDb(':memory:'), { rateLimiting: false });
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.equal(typeof res.body.uptime, 'number');
});

test('health check returns 503 (so the platform restarts the service) when the database fails', async () => {
  const spy = quiet();
  const res = await request(createApp(brokenDb, { rateLimiting: false })).get('/api/health');
  spy.mock.restore();
  assert.equal(res.status, 503);
  assert.equal(res.body.status, 'error');
  assert.ok(!JSON.stringify(res.body).includes('SQLITE_IOERR'));
});

test('behind one trusted proxy, each visitor IP gets its own rate-limit bucket', async () => {
  const app = createApp(createDb(':memory:'), { rateLimiting: true, trustProxy: 1 });
  const attempt = ip => request(app).post('/api/auth/login').set('X-Forwarded-For', ip).send({ email: 'nobody@example.com', password: 'whatever1' });
  // 35 different visitors: nobody is limited
  for (let i = 1; i <= 35; i++) assert.equal((await attempt(`10.0.0.${i}`)).status, 401);
  // one visitor hammering the login: blocked after 30 attempts
  let last;
  for (let i = 0; i < 31; i++) last = await attempt('203.0.113.9');
  assert.equal(last.status, 429);
  assert.equal(last.body.error.message, 'Too many attempts, try again later');
  // a different visitor is still fine
  assert.equal((await attempt('203.0.113.10')).status, 401);
});

test('CORS headers are not sent when no origin is configured (same-origin deployment)', async () => {
  const app = createApp(createDb(':memory:'), { rateLimiting: false, corsOrigin: '' });
  const res = await request(app).get('/api/health').set('Origin', 'https://evil.example');
  assert.equal(res.headers['access-control-allow-origin'], undefined);
});

test('CORS allows only the configured origin when one is set', async () => {
  const app = createApp(createDb(':memory:'), { rateLimiting: false, corsOrigin: 'https://app.example.com' });
  const res = await request(app).get('/api/health').set('Origin', 'https://app.example.com');
  assert.equal(res.headers['access-control-allow-origin'], 'https://app.example.com');
});

test('security headers: CSP, nosniff, HSTS, no X-Powered-By', async () => {
  const app = createApp(createDb(':memory:'), { rateLimiting: false });
  const res = await request(app).get('/api/health');
  assert.ok(res.headers['content-security-policy']);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.ok(res.headers['strict-transport-security']);
  assert.equal(res.headers['x-powered-by'], undefined);
});

test('dotfiles and files outside the client folder are not served', async () => {
  const app = createApp(createDb(':memory:'), { rateLimiting: false, clientDir });
  for (const url of ['/.env', '/.gitignore', '/%2e%2e/server/.env', '/..%2fserver%2fpackage.json', '/../server/package.json']) {
    const res = await request(app).get(url);
    assert.notEqual(res.status, 200, `${url} must not be served`);
  }
});

test('an unexpected error returns a generic 500 and the log line holds no password or internal detail in the response', async () => {
  const spy = quiet();
  const res = await request(createApp(brokenDb, { rateLimiting: false }))
    .post('/api/auth/login').send({ email: 'a@example.com', password: 'SuperSecret123' });
  const logged = spy.mock.calls.map(c => String(c.arguments[0])).join('\n');
  spy.mock.restore();
  assert.equal(res.status, 500);
  assert.equal(res.body.error.message, 'Internal server error');
  assert.ok(!JSON.stringify(res.body).includes('SQLITE_IOERR'));
  const entry = JSON.parse(logged.split('\n')[0]);
  assert.equal(entry.level, 'error');
  assert.equal(entry.path, '/api/auth/login');
  assert.ok(!logged.includes('SuperSecret123'), 'passwords must never be logged');
});

test('request logging (when enabled) writes one JSON line per request, without query strings, tokens or health checks', async () => {
  const lines = [];
  const spy = mock.method(console, 'log', l => lines.push(l));
  const app = createApp(createDb(':memory:'), { rateLimiting: false, logRequests: true });
  await request(app).get('/api/health');
  await request(app).get('/api/topics?search=private-term').set('Authorization', 'Bearer SECRET.TOKEN.VALUE');
  spy.mock.restore();
  assert.equal(lines.length, 1); // the health check is skipped
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.method, 'GET');
  assert.equal(entry.path, '/api/topics');
  assert.equal(entry.status, 401);
  assert.ok(!lines[0].includes('private-term') && !lines[0].includes('SECRET.TOKEN.VALUE'));
});

test('request logging is off when disabled', async () => {
  const lines = [];
  const spy = mock.method(console, 'log', l => lines.push(l));
  await request(createApp(createDb(':memory:'), { rateLimiting: false, logRequests: false })).get('/api/topics');
  spy.mock.restore();
  assert.equal(lines.length, 0);
});
