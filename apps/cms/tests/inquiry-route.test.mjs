import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const require = createRequire(import.meta.url);
const cms = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(cms, '.cache', `inquiry-tests-${process.pid}`);
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', path.join(cms, 'tsconfig.json'), '--outDir', output], { stdio: 'pipe' });
after(() => rmSync(output, { recursive: true, force: true }));
const load = name => require(path.join(output, 'src', name)).default;
const core = path.dirname(require.resolve('@strapi/core'));
const { createPolicicesMiddleware } = require(path.join(core, 'services/server/policy.js'));
const policiesRegistry = require(path.join(core, 'registries/policies.js'));
const { errors } = require(path.join(core, 'middlewares/errors.js'));
const createKoaApp = require(path.join(core, 'services/server/koa.js'));
const loadPolicies = require(path.join(core, 'loaders/policies.js'));
const valid = { name: ' Jamie ', email: ' jamie@example.com ', country: ' NL ', message: ' Six modules ', status: 'won', followUpStatus: 'won', internalNotes: 'injected', turnstileToken: 'proof' };

async function withEndpoint(run, { save = async () => ({ documentId: 'saved-123' }) } = {}) {
  const writes = [];
  const registry = policiesRegistry();
  await loadPolicies({ dirs: { dist: { policies: path.join(output, 'src/policies') } }, get: () => registry });
  const strapi = {
    get: () => registry, contentType: () => ({ kind: 'collectionType' }),
    documents: uid => { assert.equal(uid, 'api::inquiry.inquiry'); return { create: async params => { writes.push(params); return save(params); } }; },
    service: () => service, log: { error(error) { throw error; } }
  };
  const service = load('api/inquiry/services/inquiry.js')({ strapi });
  globalThis.strapi = strapi;
  const controller = load('api/inquiry/controllers/inquiry.js')({ strapi });
  const route = load('api/inquiry/routes/inquiry.js').routes[0];
  const app = createKoaApp({ proxy: false, keys: ['test-key'] });
  app.use(errors());
  app.use(async (ctx, next) => { ctx.request.body = JSON.parse(await new Promise(resolve => { let body = ''; ctx.req.on('data', part => body += part); ctx.req.on('end', () => resolve(body)); })); await next(); });
  app.use(createPolicicesMiddleware(route, strapi));
  app.use(async ctx => { const receipt = await controller.create(ctx); if (receipt) ctx.body = receipt; });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const submit = async (data = valid, headers = {}) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer test-secret', 'x-inquiry-client': '203.0.113.10', ...headers }, body: JSON.stringify(data) });
    return { status: res.status, body: await res.json() };
  };
  try { await run({ submit, writes, service, route }); } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('compiled inquiry route attaches the policy and authenticates before consuming the forwarded IP quota', async () => {
  process.env.STRAPI_SERVER_TOKEN = 'test-secret';
  await withEndpoint(async ({ submit, writes, route }) => {
    assert.deepEqual(route.config.policies, ['global::rate-limit-inquiry']);
    for (let i = 0; i < 6; i++) assert.equal((await submit(valid, { authorization: 'Bearer wrong', 'x-inquiry-client': '203.0.113.11' })).status, 401);
    for (let i = 0; i < 5; i++) assert.equal((await submit(valid, { 'x-inquiry-client': '203.0.113.11' })).status, 200);
    assert.equal((await submit(valid, { 'x-inquiry-client': '203.0.113.11' })).status, 429);
    assert.equal(writes.length, 5);
  });
});

test('persistence service strips private/proof fields, normalizes values and only acknowledges a saved identifier', async () => {
  await withEndpoint(async ({ service, writes }) => {
    assert.equal(typeof service.submit, 'function');
    assert.deepEqual(await service.submit(valid), { id: 'saved-123', status: 'received' });
    assert.deepEqual(writes, [{ data: { name: 'Jamie', email: 'jamie@example.com', whatsapp: '', country: 'NL', productType: '', quantity: '', message: 'Six modules', source: '', followUpStatus: 'new' } }]);
    await assert.rejects(service.submit({ ...valid, website: 'spam' }));
    assert.equal(writes.length, 1);
  });
});

test('chatbox WhatsApp-only contact persists as a new inquiry without inventing an email', async () => {
  await withEndpoint(async ({ service, writes }) => {
    const input = { ...valid, email: '', whatsapp: '+44 (7700) 900-123', source: 'chatbox:en:/', message: 'Hello\n\nI need six houses.' };
    await assert.rejects(service.submit({ ...input, whatsapp: '' }));
    assert.equal(writes.length, 0);
    assert.deepEqual(await service.submit(input), { id: 'saved-123', status: 'received' });
    assert.equal(writes[0].data.email, null);
    assert.equal(writes[0].data.whatsapp, '+447700900123');
    assert.equal(writes[0].data.message, input.message);
    assert.equal(writes[0].data.source, 'chatbox:en:/');
    assert.equal(writes[0].data.followUpStatus, 'new');
  });
});

test('controller conceals persistence failures and never issues a receipt', async () => {
  await withEndpoint(async ({ submit }) => {
    const response = await submit(valid, { 'x-inquiry-client': '203.0.113.12' });
    assert.equal(response.status, 502);
    assert.equal(JSON.stringify(response.body).includes('database-password'), false);
    assert.equal(response.body.id, undefined);
  }, { save: async () => { throw new Error('database-password'); } });
});

test('arbitrary persistence rejection values and upstream status codes cannot be mistaken for challenge configuration', async () => {
  for (const [index, rejection] of [null, Object.assign(new Error('provider diagnostic'), { status: 503 })].entries()) {
    await withEndpoint(async ({ submit }) => {
      assert.equal((await submit(valid, { 'x-inquiry-client': `203.0.113.${50 + index}` })).status, 502);
    }, { save: async () => { throw rejection; } });
  }
});

test('malformed forwarded IP values cannot obtain independent quotas', async () => {
  await withEndpoint(async ({ submit }) => {
    for (let i = 0; i < 5; i++) assert.equal((await submit(valid, { 'x-inquiry-client': `invalid-${i}` })).status, 200);
    assert.equal((await submit(valid, { 'x-inquiry-client': 'invalid-sixth' })).status, 429);
  });
});

test('configured challenge requires authoritative proof with expected action and hostname before persistence', async () => {
  process.env.TURNSTILE_SITE_KEY = 'site'; process.env.TURNSTILE_SECRET_KEY = 'private-secret'; process.env.TURNSTILE_EXPECTED_HOSTNAME = 'example.com';
  const original = globalThis.fetch;
  let verification = { success: true, action: 'inquiry', hostname: 'example.com' };
  let fail = false;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('http://127.0.0.1')) return original(url, options);
    requests.push({ url, options });
    if (fail) throw new Error('provider-secret-diagnostic');
    return { ok: true, json: async () => verification };
  };
  try {
    await withEndpoint(async ({ submit, writes }) => {
      const send = (data = valid) => submit(data, { 'x-inquiry-client': `203.0.113.${20 + writes.length + requests.length}` });
      assert.equal((await send({ ...valid, turnstileToken: '' })).status, 400);
      assert.equal((await send({ ...valid, turnstileToken: 'x'.repeat(2049) })).status, 400);
      assert.equal(writes.length, 0);
      assert.equal(requests.length, 0);
      assert.deepEqual(await send(), { status: 200, body: { id: 'saved-123', status: 'received' } });
      assert.equal(requests[0].url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
      assert.equal(requests[0].options.method, 'POST');
      assert.deepEqual(JSON.parse(requests[0].options.body), { secret: 'private-secret', response: 'proof', remoteip: '203.0.113.20' });
      assert.ok(requests[0].options.signal instanceof AbortSignal);
      for (const result of [{ success: false, 'error-codes': ['timeout-or-duplicate'] }, { success: true, action: 'login', hostname: 'example.com' }, { success: true, action: 'inquiry', hostname: 'wrong.com' }, null]) {
        verification = result;
        assert.equal((await send()).status, 400);
      }
      fail = true;
      const response = await send();
      assert.equal(response.status, 502);
      assert.equal(JSON.stringify(response.body).includes('provider-secret'), false);
      assert.equal(writes.length, 1);
    });
  } finally { globalThis.fetch = original; delete process.env.TURNSTILE_SITE_KEY; delete process.env.TURNSTILE_SECRET_KEY; delete process.env.TURNSTILE_EXPECTED_HOSTNAME; }
});

test('partial challenge configuration fails closed and an empty saved entity cannot be acknowledged', async () => {
  for (const key of ['TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY']) {
    process.env[key] = 'configured';
    try { await withEndpoint(async ({ submit, writes }) => { assert.equal((await submit(valid, { 'x-inquiry-client': `203.0.113.${key === 'TURNSTILE_SITE_KEY' ? 40 : 41}` })).status, 503); assert.equal(writes.length, 0); }); }
    finally { delete process.env[key]; }
  }
  await withEndpoint(async ({ submit }) => { assert.equal((await submit(valid, { 'x-inquiry-client': '203.0.113.42' })).status, 502); }, { save: async () => ({}) });
});
