const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { createDb } = require('../src/db');
const { createApp } = require('../src/app');

const clientDir = path.join(__dirname, '../../client');
const app = createApp(createDb(':memory:'), { rateLimiting: false, clientDir });

test('server serves the front-end pages and assets', async () => {
  for (const [url, type] of [['/', /html/], ['/login.html', /html/], ['/dashboard.html', /html/], ['/topic.html', /html/], ['/css/styles.css', /css/], ['/js/api.js', /javascript/]]) {
    const res = await request(app).get(url);
    assert.equal(res.status, 200, url);
    assert.match(res.headers['content-type'], type, url);
  }
});

test('security headers are sent and /api 404s stay JSON', async () => {
  const res = await request(app).get('/api/nope');
  assert.equal(res.status, 404);
  assert.match(res.headers['content-type'], /json/);
  assert.ok(res.headers['content-security-policy']);
});

test('every local script and stylesheet referenced by the pages exists', () => {
  const pages = fs.readdirSync(clientDir).filter(f => f.endsWith('.html'));
  assert.ok(pages.length >= 4);
  for (const page of pages) {
    const html = fs.readFileSync(path.join(clientDir, page), 'utf8');
    for (const [, ref] of html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)) {
      assert.ok(fs.existsSync(path.join(clientDir, ref)), `${page} references missing file ${ref}`);
    }
  }
});

test('front-end pages contain no inline scripts or inline style attributes (CSP safe)', () => {
  for (const page of fs.readdirSync(clientDir).filter(f => f.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(clientDir, page), 'utf8');
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), `${page} has an inline script`);
    assert.ok(!/\sstyle="/.test(html), `${page} has an inline style attribute`);
  }
});
