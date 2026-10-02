/* Syntax-checks every JavaScript file (server, tests, scripts and the client). Works on Windows, macOS and Linux. */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const roots = ['src', 'tests', 'scripts', '../client/js'].map(d => path.join(__dirname, '..', d));
const files = [];
const walk = dir => {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) files.push(p);
  }
};
roots.forEach(walk);

let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) { failed++; console.error(`FAIL ${path.relative(process.cwd(), f)}\n${r.stderr}`); }
}
console.log(`${files.length - failed}/${files.length} files passed the syntax check`);
process.exit(failed ? 1 : 0);
