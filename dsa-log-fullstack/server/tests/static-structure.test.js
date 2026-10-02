const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const clientDir = path.join(__dirname, '../../client');

test('all HTML pages reference files that exist locally', () => {
  const pages = fs.readdirSync(clientDir).filter(file => file.endsWith('.html'));
  assert.ok(pages.length >= 4);

  for (const page of pages) {
    const html = fs.readFileSync(path.join(clientDir, page), 'utf8');
    for (const [, ref] of html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)) {
      assert.ok(fs.existsSync(path.join(clientDir, ref)), `${page} references missing ${ref}`);
    }
  }
});

test('HTML pages do not contain inline scripts or style attributes', () => {
  for (const page of fs.readdirSync(clientDir).filter(file => file.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(clientDir, page), 'utf8');
    assert.equal(/<script(?![^>]*\bsrc=)[^>]*>/.test(html), false, `${page} has inline script`);
    assert.equal(/\sstyle="/.test(html), false, `${page} has inline style`);
  }
});

test('expected front-end JavaScript files are present', () => {
  for (const file of ['api.js', 'ui.js', 'login.js', 'dashboard.js', 'topic.js', 'landing.js']) {
    assert.equal(fs.existsSync(path.join(clientDir, 'js', file)), true, `${file} is missing`);
  }
});
