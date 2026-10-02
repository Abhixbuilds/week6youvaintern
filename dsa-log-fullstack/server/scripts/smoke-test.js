/* Live smoke test / automated part of the user acceptance test.
   Usage:  node scripts/smoke-test.js https://your-app.onrender.com
           (or set BASE_URL).  Creates one throw-away user, exercises the main flows, then deletes what it created.
   Writes the result to logs/smoke-<timestamp>.txt so it can be attached to the report. Needs Node 18+ (global fetch). */
const fs = require('node:fs');
const path = require('node:path');

const base = (process.argv[2] || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const results = [];
const lines = [];
const out = s => { lines.push(s); console.log(s); };

async function step(name, fn) {
  const t0 = performance.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: performance.now() - t0 });
    out(`PASS  ${name}  (${Math.round(performance.now() - t0)} ms)`);
  } catch (e) {
    results.push({ name, ok: false, ms: performance.now() - t0 });
    out(`FAIL  ${name}\n      ${e.message}`);
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

async function call(method, url, { token, body, retries = 0 } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000) });
      const text = await res.text();
      let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
      return { status: res.status, headers: res.headers, json, text };
    } catch (e) {
      if (attempt >= retries) throw new Error(`${method} ${url} failed: ${e.message}`);
    }
  }
}

(async () => {
  out(`Smoke test against ${base}`);
  out(`Started ${new Date().toISOString()}\n`);
  const email = `smoke-${Date.now()}@example.com`;
  const password = 'SmokeTest123';
  let token, topicId, problemId;

  // free hosting plans sleep when idle; the first request can take up to a minute while the service wakes up
  await step('Health check answers (allows time for a sleeping free instance to wake)', async () => {
    const r = await call('GET', '/api/health', { retries: 2 });
    expect(r.status === 200 && r.json && r.json.status === 'ok', `expected 200 {status:"ok"}, got ${r.status} ${r.text.slice(0, 100)}`);
  });
  await step('Home page and login page load as HTML', async () => {
    for (const p of ['/', '/login.html', '/dashboard.html']) {
      const r = await call('GET', p);
      expect(r.status === 200 && /html/.test(r.headers.get('content-type')), `${p} returned ${r.status}`);
    }
  });
  await step('Site is served over HTTPS (skipped for localhost)', async () => {
    if (/^http:\/\/(localhost|127\.)/.test(base)) return;
    expect(base.startsWith('https://'), 'URL is not https');
    const r = await call('GET', '/');
    expect(r.headers.get('strict-transport-security'), 'Strict-Transport-Security header missing');
  });
  await step('Security headers present, X-Powered-By hidden', async () => {
    const r = await call('GET', '/api/health');
    expect(r.headers.get('content-security-policy'), 'Content-Security-Policy missing');
    expect(r.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options missing');
    expect(!r.headers.get('x-powered-by'), 'X-Powered-By should be hidden');
  });
  await step('Register a new account returns 201 and a token', async () => {
    const r = await call('POST', '/api/auth/register', { body: { name: 'Smoke Test', email, password } });
    expect(r.status === 201 && r.json.token, `expected 201 + token, got ${r.status} ${r.text.slice(0, 120)}`);
    token = r.json.token;
  });
  await step('Weak password is rejected with 400', async () => {
    const r = await call('POST', '/api/auth/register', { body: { name: 'Smoke Test', email: `weak-${email}`, password: 'short' } });
    expect(r.status === 400, `expected 400, got ${r.status}`);
  });
  await step('Wrong password is rejected with 401, correct password logs in', async () => {
    let r = await call('POST', '/api/auth/login', { body: { email, password: 'WrongPass123' } });
    expect(r.status === 401, `wrong password: expected 401, got ${r.status}`);
    r = await call('POST', '/api/auth/login', { body: { email, password } });
    expect(r.status === 200 && r.json.token, `login: expected 200 + token, got ${r.status}`);
    token = r.json.token;
  });
  await step('Protected route without a token returns 401', async () => {
    const r = await call('GET', '/api/topics');
    expect(r.status === 401, `expected 401, got ${r.status}`);
  });
  await step('New account has 6 starter topics', async () => {
    const r = await call('GET', '/api/topics', { token });
    expect(r.status === 200 && r.json.count === 6, `expected 6 topics, got ${r.json && r.json.count}`);
  });
  await step('Create a topic and a problem, then tick the problem', async () => {
    let r = await call('POST', '/api/topics', { token, body: { title: 'Smoke Graphs', description: 'created by smoke test' } });
    expect(r.status === 201, `create topic: ${r.status}`);
    topicId = r.json.topic.id;
    r = await call('POST', `/api/topics/${topicId}/problems`, { token, body: { name: 'Number of Islands', level: 'Medium' } });
    expect(r.status === 201, `create problem: ${r.status}`);
    problemId = r.json.problem.id;
    r = await call('PATCH', `/api/problems/${problemId}`, { token, body: { solved: true } });
    expect(r.status === 200 && r.json.problem.solved === true, `tick problem: ${r.status}`);
  });
  await step('Progress and stats reflect the change', async () => {
    let r = await call('GET', `/api/topics/${topicId}`, { token });
    expect(r.json.topic.progress.percent === 100, `topic progress ${r.json.topic.progress.percent}% (expected 100)`);
    r = await call('GET', '/api/stats', { token });
    expect(r.status === 200 && r.json.solved === 1 && r.json.totalTopics === 7, `stats: ${JSON.stringify(r.json)}`);
  });
  await step('Notes can be saved', async () => {
    const r = await call('PATCH', `/api/topics/${topicId}`, { token, body: { notes: 'remember the visited set' } });
    expect(r.status === 200 && r.json.topic.notes === 'remember the visited set', `notes: ${r.status}`);
  });
  await step('Search and status filter work', async () => {
    let r = await call('GET', '/api/topics?search=smoke', { token });
    expect(r.json.count === 1, `search expected 1, got ${r.json.count}`);
    r = await call('GET', '/api/topics?status=done', { token });
    expect(r.json.count === 1, `done filter expected 1, got ${r.json.count}`);
  });
  await step('Invalid input is rejected with 400 and a JSON error', async () => {
    const r = await call('POST', '/api/topics', { token, body: {} });
    expect(r.status === 400 && r.json && r.json.error, `expected 400 JSON error, got ${r.status}`);
  });
  await step('Unknown API route returns a JSON 404', async () => {
    const r = await call('GET', '/api/does-not-exist');
    expect(r.status === 404 && r.json && r.json.error, `expected JSON 404, got ${r.status}`);
  });
  await step('Dotfiles are not served (/.env is not reachable)', async () => {
    const r = await call('GET', '/.env');
    expect(r.status !== 200, `/.env returned 200`);
  });
  await step('Delete the test topic (cleanup)', async () => {
    const r = await call('DELETE', `/api/topics/${topicId}`, { token });
    expect(r.status === 204, `expected 204, got ${r.status}`);
  });

  const failed = results.filter(r => !r.ok).length;
  out(`\n${results.length - failed}/${results.length} checks passed${failed ? `, ${failed} FAILED` : ''}`);
  out('Note: the throw-away smoke-test user stays in the database (there is no delete-account endpoint).');
  fs.mkdirSync(path.join(__dirname, '../logs'), { recursive: true });
  const file = path.join(__dirname, '../logs', `smoke-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);
  fs.writeFileSync(file, lines.join('\n') + '\n');
  console.log(`Saved ${path.relative(process.cwd(), file)}`);
  process.exit(failed ? 1 : 0);
})();
