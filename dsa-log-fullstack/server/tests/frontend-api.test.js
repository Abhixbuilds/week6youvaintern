const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../../client/js/api.js'), 'utf8');

function loadApi({ fetchImpl, storedToken = null } = {}) {
  const storage = new Map(storedToken ? [['dsalog_token', storedToken]] : []);
  const location = { href: '' };
  const context = {
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key),
    },
    fetch: fetchImpl,
    location,
    console,
  };
  vm.createContext(context);
  vm.runInContext(source + '\nthis.__Api = Api;', context);
  return { Api: context.__Api, storage, location };
}

test('API client adds the bearer token and parses JSON responses', async () => {
  let call;
  const { Api } = loadApi({
    storedToken: 'abc123',
    fetchImpl: async (url, options) => {
      call = { url, options };
      return {
        status: 200,
        ok: true,
        json: async () => ({ topics: [] }),
      };
    },
  });

  const data = await Api.get('/topics?search=sort');
  assert.deepEqual(data, { topics: [] });
  assert.equal(call.url, '/api/topics?search=sort');
  assert.equal(call.options.method, 'GET');
  assert.equal(call.options.headers.Authorization, 'Bearer abc123');
});

test('API client serializes JSON bodies and returns 204 as null', async () => {
  let call;
  const { Api } = loadApi({
    fetchImpl: async (url, options) => {
      call = { url, options };
      return { status: 204, ok: true, json: async () => ({}) };
    },
  });

  const result = await Api.post('/topics', { title: 'Graphs' });
  assert.equal(result, null);
  assert.equal(call.options.headers['Content-Type'], 'application/json');
  assert.equal(call.options.body, JSON.stringify({ title: 'Graphs' }));
});

test('API client converts server errors into ApiError', async () => {
  const { Api } = loadApi({
    fetchImpl: async () => ({
      status: 400,
      ok: false,
      json: async () => ({ error: { message: 'Validation failed', details: [{ field: 'title', message: 'Title is required' }] } }),
    }),
  });

  await assert.rejects(
    Api.post('/topics', {}),
    error => error.name === 'Error' && error.status === 400 && error.message === 'Validation failed'
      && error.details[0].field === 'title'
  );
});

test('API client reports network failures without exposing fetch errors', async () => {
  const { Api } = loadApi({ fetchImpl: async () => { throw new Error('connection refused'); } });
  await assert.rejects(Api.get('/stats'), error => error.status === 0 && /Cannot reach the server/.test(error.message));
});
