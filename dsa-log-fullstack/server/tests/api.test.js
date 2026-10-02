process.env.BCRYPT_ROUNDS = '4'; // fast hashing in tests
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createDb } = require('../src/db');
const { createApp } = require('../src/app');

let app;
before(() => { app = createApp(createDb(':memory:'), { rateLimiting: false }); });

const creds = (n = 'a') => ({ name: 'Test User', email: `${n}@example.com`, password: 'Passw0rdOK' });
const register = async n => (await request(app).post('/api/auth/register').send(creds(n))).body;
const authed = token => ({ Authorization: `Bearer ${token}` });

test('GET /api/health returns ok', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('register creates user, returns token and never the password hash', async () => {
  const res = await request(app).post('/api/auth/register').send(creds('reg'));
  assert.equal(res.status, 201);
  assert.ok(res.body.token);
  assert.equal(res.body.user.email, 'reg@example.com');
  assert.equal(res.body.user.password_hash, undefined);
});

test('register rejects weak password, bad email and unknown fields', async () => {
  let res = await request(app).post('/api/auth/register').send({ ...creds('w'), password: 'short' });
  assert.equal(res.status, 400);
  assert.ok(res.body.error.details.some(d => d.field === 'password'));
  res = await request(app).post('/api/auth/register').send({ ...creds('w'), email: 'nope' });
  assert.equal(res.status, 400);
  res = await request(app).post('/api/auth/register').send({ ...creds('w'), isAdmin: true });
  assert.equal(res.status, 400);
});

test('register rejects duplicate email with 409', async () => {
  await register('dup');
  const res = await request(app).post('/api/auth/register').send(creds('dup'));
  assert.equal(res.status, 409);
});

test('login works with correct password and fails with wrong one', async () => {
  await register('log');
  let res = await request(app).post('/api/auth/login').send({ email: 'log@example.com', password: 'Passw0rdOK' });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  res = await request(app).post('/api/auth/login').send({ email: 'log@example.com', password: 'wrong' });
  assert.equal(res.status, 401);
  res = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'Passw0rdOK' });
  assert.equal(res.status, 401);
});

test('protected routes require a valid token', async () => {
  assert.equal((await request(app).get('/api/topics')).status, 401);
  assert.equal((await request(app).get('/api/topics').set(authed('garbage'))).status, 401);
  const { token } = await register('me');
  const res = await request(app).get('/api/auth/me').set(authed(token));
  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, 'me@example.com');
});

test('new accounts start with six seeded topics', async () => {
  const { token } = await register('seed');
  const res = await request(app).get('/api/topics').set(authed(token));
  assert.equal(res.body.count, 6);
  assert.equal(res.body.topics[0].progress.total, 5);
});

test('topics: full CRUD cycle', async () => {
  const { token } = await register('crud');
  const h = authed(token);
  let res = await request(app).post('/api/topics').set(h).send({ title: 'Graphs', description: 'BFS and DFS' });
  assert.equal(res.status, 201);
  const id = res.body.topic.id;
  assert.equal(res.body.topic.progress.total, 0);

  res = await request(app).get(`/api/topics/${id}`).set(h);
  assert.equal(res.body.topic.title, 'Graphs');
  assert.deepEqual(res.body.topic.problems, []);

  res = await request(app).patch(`/api/topics/${id}`).set(h).send({ notes: 'Remember visited set' });
  assert.equal(res.status, 200);
  assert.equal(res.body.topic.notes, 'Remember visited set');
  assert.equal(res.body.topic.title, 'Graphs');

  res = await request(app).delete(`/api/topics/${id}`).set(h);
  assert.equal(res.status, 204);
  assert.equal((await request(app).get(`/api/topics/${id}`).set(h)).status, 404);
});

test('topics: validation errors and filters', async () => {
  const { token } = await register('val');
  const h = authed(token);
  assert.equal((await request(app).post('/api/topics').set(h).send({})).status, 400);
  assert.equal((await request(app).patch('/api/topics/1').set(h).send({})).status, 400);
  assert.equal((await request(app).get('/api/topics/abc').set(h)).status, 400);
  assert.equal((await request(app).get('/api/topics?status=bogus').set(h)).status, 400);
  const res = await request(app).get('/api/topics?search=sort').set(h);
  assert.equal(res.body.count, 1);
  assert.equal(res.body.topics[0].title, 'Sorting');
});

test('users cannot read or change each other\'s data', async () => {
  const a = await register('ownerA');
  const b = await register('ownerB');
  const topics = (await request(app).get('/api/topics').set(authed(a.token))).body.topics;
  const topicId = topics[0].id;
  const problemId = (await request(app).get(`/api/topics/${topicId}`).set(authed(a.token))).body.topic.problems[0].id;
  assert.equal((await request(app).get(`/api/topics/${topicId}`).set(authed(b.token))).status, 404);
  assert.equal((await request(app).delete(`/api/topics/${topicId}`).set(authed(b.token))).status, 404);
  assert.equal((await request(app).patch(`/api/problems/${problemId}`).set(authed(b.token)).send({ solved: true })).status, 404);
  assert.equal((await request(app).post(`/api/topics/${topicId}/problems`).set(authed(b.token)).send({ name: 'x', level: 'Easy' })).status, 404);
});

test('problems: create, update, filter, delete', async () => {
  const { token } = await register('prob');
  const h = authed(token);
  const topicId = (await request(app).post('/api/topics').set(h).send({ title: 'Trees' })).body.topic.id;

  let res = await request(app).post(`/api/topics/${topicId}/problems`).set(h).send({ name: 'Invert Binary Tree', level: 'Easy' });
  assert.equal(res.status, 201);
  assert.equal(res.body.problem.solved, false);
  const pid = res.body.problem.id;

  res = await request(app).post(`/api/topics/${topicId}/problems`).set(h).send({ name: 'Bad', level: 'Impossible' });
  assert.equal(res.status, 400);

  res = await request(app).patch(`/api/problems/${pid}`).set(h).send({ solved: true });
  assert.equal(res.body.problem.solved, true);
  assert.equal(res.body.problem.name, 'Invert Binary Tree');

  res = await request(app).get(`/api/topics/${topicId}/problems?solved=true`).set(h);
  assert.equal(res.body.count, 1);
  res = await request(app).get(`/api/topics/${topicId}/problems?level=Hard`).set(h);
  assert.equal(res.body.count, 0);

  assert.equal((await request(app).get(`/api/topics/${topicId}`).set(h)).body.topic.progress.percent, 100);

  assert.equal((await request(app).delete(`/api/problems/${pid}`).set(h)).status, 204);
  assert.equal((await request(app).get(`/api/problems/${pid}`).set(h)).status, 404);
});

test('deleting a topic also deletes its problems (cascade)', async () => {
  const { token } = await register('casc');
  const h = authed(token);
  const topicId = (await request(app).post('/api/topics').set(h).send({ title: 'Temp' })).body.topic.id;
  const pid = (await request(app).post(`/api/topics/${topicId}/problems`).set(h).send({ name: 'P', level: 'Easy' })).body.problem.id;
  await request(app).delete(`/api/topics/${topicId}`).set(h);
  assert.equal((await request(app).get(`/api/problems/${pid}`).set(h)).status, 404);
});

test('stats reflect solved problems', async () => {
  const { token } = await register('stat');
  const h = authed(token);
  let res = await request(app).get('/api/stats').set(h);
  assert.equal(res.body.totalProblems, 30);
  assert.equal(res.body.solved, 0);
  const topic = (await request(app).get('/api/topics').set(h)).body.topics[0];
  const probs = (await request(app).get(`/api/topics/${topic.id}`).set(h)).body.topic.problems;
  for (const p of probs) await request(app).patch(`/api/problems/${p.id}`).set(h).send({ solved: true });
  res = await request(app).get('/api/stats').set(h);
  assert.equal(res.body.solved, 5);
  assert.equal(res.body.topicsFinished, 1);
  assert.equal(res.body.percent, 17);
});

test('unknown routes return JSON 404 and bad JSON returns 400', async () => {
  let res = await request(app).get('/api/nope');
  assert.equal(res.status, 404);
  assert.ok(res.body.error.message);
  res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
  assert.equal(res.status, 400);
});


test('topic status filters return only matching progress states', async () => {
  const { token } = await register('status');
  const h = authed(token);
  const topicId = (await request(app).post('/api/topics').set(h).send({ title: 'Filter Test' })).body.topic.id;

  const first = await request(app).post(`/api/topics/${topicId}/problems`).set(h).send({ name: 'One', level: 'Easy' });
  const second = await request(app).post(`/api/topics/${topicId}/problems`).set(h).send({ name: 'Two', level: 'Medium' });
  await request(app).post(`/api/topics/${topicId}/problems`).set(h).send({ name: 'Three', level: 'Hard' });

  let res = await request(app).get('/api/topics?status=todo').set(h);
  assert.ok(res.body.topics.some(t => t.id === topicId));

  await request(app).patch(`/api/problems/${first.body.problem.id}`).set(h).send({ solved: true });
  res = await request(app).get('/api/topics?status=doing').set(h);
  assert.ok(res.body.topics.some(t => t.id === topicId));

  await request(app).patch(`/api/problems/${second.body.problem.id}`).set(h).send({ solved: true });
  const third = await request(app).get(`/api/topics/${topicId}`).set(h);
  await request(app).patch(`/api/problems/${third.body.topic.problems[2].id}`).set(h).send({ solved: true });

  res = await request(app).get('/api/topics?status=done').set(h);
  assert.ok(res.body.topics.some(t => t.id === topicId));
});

test('problem filters are applied by the database query', async () => {
  const { token } = await register('problemfilters');
  const h = authed(token);
  const topicId = (await request(app).post('/api/topics').set(h).send({ title: 'Problem Filters' })).body.topic.id;

  const easy = await request(app).post(`/api/topics/${topicId}/problems`).set(h).send({ name: 'Easy', level: 'Easy' });
  await request(app).post(`/api/topics/${topicId}/problems`).set(h).send({ name: 'Medium', level: 'Medium' });
  await request(app).post(`/api/topics/${topicId}/problems`).set(h).send({ name: 'Hard', level: 'Hard' });
  await request(app).patch(`/api/problems/${easy.body.problem.id}`).set(h).send({ solved: true });

  let res = await request(app).get(`/api/topics/${topicId}/problems?level=Easy&solved=true`).set(h);
  assert.equal(res.status, 200);
  assert.equal(res.body.count, 1);
  assert.equal(res.body.problems[0].name, 'Easy');

  res = await request(app).get(`/api/topics/${topicId}/problems?level=Hard&solved=true`).set(h);
  assert.equal(res.body.count, 0);
});

test('request body limit rejects oversized JSON', async () => {
  const { token } = await register('largebody');
  const res = await request(app)
    .post('/api/topics')
    .set(authed(token))
    .send({ title: 'x'.repeat(11000) });
  assert.equal(res.status, 413);
});
