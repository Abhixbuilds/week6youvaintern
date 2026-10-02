const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
// run from an empty folder so dotenv cannot load a real .env file and change the results
const original = process.cwd();
const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'dsalog-cfg-'));
process.chdir(empty);

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
after(() => { process.chdir(original); fs.rmSync(empty, { recursive: true, force: true }); });

const KEYS = ['NODE_ENV', 'PORT', 'JWT_SECRET', 'JWT_EXPIRES_IN', 'DB_PATH', 'CORS_ORIGIN', 'BCRYPT_ROUNDS', 'TRUST_PROXY', 'LOG_REQUESTS', 'CLIENT_DIR'];
const configPath = require.resolve('../src/config');
const GOOD_SECRET = 'a'.repeat(40);

function loadConfig(env = {}) {
  const saved = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));
  KEYS.forEach(k => delete process.env[k]);
  Object.assign(process.env, env);
  delete require.cache[configPath];
  try { return require(configPath); }
  finally { KEYS.forEach(k => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]))); }
}

test('development defaults: CORS open, no proxy trust, request logging off', () => {
  const c = loadConfig();
  assert.equal(c.isProd, false);
  assert.equal(c.port, 3000);
  assert.equal(c.corsOrigin, '*');
  assert.equal(c.trustProxy, false);
  assert.equal(c.logRequests, false);
  assert.equal(c.bcryptRounds, 10);
  assert.equal(c.dbPath, './data/dsa-log.db');
});

test('production refuses to start without JWT_SECRET', () => {
  assert.throws(() => loadConfig({ NODE_ENV: 'production' }), /JWT_SECRET must be set in production/);
});

test('production refuses a JWT_SECRET shorter than 32 characters', () => {
  assert.throws(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'too-short' }), /at least 32 characters/);
});

test('production defaults: no CORS, trust one proxy, request logging on', () => {
  const c = loadConfig({ NODE_ENV: 'production', JWT_SECRET: GOOD_SECRET });
  assert.equal(c.isProd, true);
  assert.equal(c.corsOrigin, '');
  assert.equal(c.trustProxy, 1);
  assert.equal(c.logRequests, true);
  assert.equal(c.jwtSecret, GOOD_SECRET);
});

test('a short secret is allowed in development only', () => {
  assert.equal(loadConfig({ JWT_SECRET: 'short' }).jwtSecret, 'short');
});

test('CORS_ORIGIN can be set explicitly in production', () => {
  const c = loadConfig({ NODE_ENV: 'production', JWT_SECRET: GOOD_SECRET, CORS_ORIGIN: 'https://app.example.com' });
  assert.equal(c.corsOrigin, 'https://app.example.com');
});

test('TRUST_PROXY accepts a number, true/false or a keyword', () => {
  assert.equal(loadConfig({ TRUST_PROXY: '2' }).trustProxy, 2);
  assert.equal(loadConfig({ TRUST_PROXY: 'true' }).trustProxy, true);
  assert.equal(loadConfig({ NODE_ENV: 'production', JWT_SECRET: GOOD_SECRET, TRUST_PROXY: 'false' }).trustProxy, false);
  assert.equal(loadConfig({ TRUST_PROXY: 'loopback' }).trustProxy, 'loopback');
});

test('LOG_REQUESTS can switch request logging on in development and off in production', () => {
  assert.equal(loadConfig({ LOG_REQUESTS: 'true' }).logRequests, true);
  assert.equal(loadConfig({ NODE_ENV: 'production', JWT_SECRET: GOOD_SECRET, LOG_REQUESTS: 'false' }).logRequests, false);
});

test('PORT from the platform is used, and a non-numeric value falls back to 3000', () => {
  assert.equal(loadConfig({ PORT: '10000' }).port, 10000);
  assert.equal(loadConfig({ PORT: 'abc' }).port, 3000);
});
