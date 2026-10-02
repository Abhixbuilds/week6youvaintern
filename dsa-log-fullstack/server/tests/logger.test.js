const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { log, logError, requestLogger } = require('../src/logger');

const capture = method => { const lines = []; const spy = mock.method(console, method, l => lines.push(l)); return { lines, spy }; };

test('log writes one JSON line with time, level and the given fields', () => {
  const { lines, spy } = capture('log');
  log('info', { event: 'startup', port: 3000 });
  spy.mock.restore();
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.level, 'info');
  assert.equal(entry.event, 'startup');
  assert.equal(entry.port, 3000);
  assert.ok(!Number.isNaN(Date.parse(entry.time)));
});

test('logError goes to stderr as JSON with method, path (without query string), message and stack', () => {
  const { lines, spy } = capture('error');
  logError(new Error('boom'), { method: 'GET', originalUrl: '/api/topics?search=secret-term' });
  spy.mock.restore();
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.level, 'error');
  assert.equal(entry.method, 'GET');
  assert.equal(entry.path, '/api/topics');
  assert.equal(entry.message, 'boom');
  assert.match(entry.stack, /Error: boom/);
  assert.ok(!lines[0].includes('secret-term'));
});

test('logError also works without a request (startup or process-level errors)', () => {
  const { lines, spy } = capture('error');
  assert.doesNotThrow(() => logError(new Error('no request')));
  spy.mock.restore();
  assert.equal(JSON.parse(lines[0]).message, 'no request');
});

test('requestLogger logs method, path, status, duration and IP when the response finishes', () => {
  const { lines, spy } = capture('log');
  const res = new EventEmitter(); res.statusCode = 201;
  let nextCalled = false;
  requestLogger({ method: 'POST', path: '/api/topics', originalUrl: '/api/topics?x=1', ip: '1.2.3.4' }, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(lines.length, 0); // nothing is logged until the response is sent
  res.emit('finish');
  spy.mock.restore();
  const entry = JSON.parse(lines[0]);
  assert.deepEqual([entry.method, entry.path, entry.status, entry.ip], ['POST', '/api/topics', 201, '1.2.3.4']);
  assert.equal(typeof entry.ms, 'number');
});

test('requestLogger skips /api/health so platform health checks do not flood the log', () => {
  const { lines, spy } = capture('log');
  const res = new EventEmitter();
  let nextCalled = false;
  requestLogger({ method: 'GET', path: '/api/health', originalUrl: '/api/health', ip: '::1' }, res, () => { nextCalled = true; });
  res.emit('finish');
  spy.mock.restore();
  assert.equal(nextCalled, true);
  assert.equal(lines.length, 0);
});
