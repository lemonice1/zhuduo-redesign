import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { load, withEnvironment } from './compiled-web.mjs';

const valid = { name: ' Alex ', email: 'alex@example.com', country: 'UK', message: 'Six modules', productType: 'module-b', source: 'homepage:Hospitality', product: 'Module B (module-b)', inquirySource: 'homepage:Hospitality', inquiryLanguage: 'en', 'target-sdk-ignore': 'true', status: 'won', internalNotes: 'private', id: 'forged' };
async function withRoute(run, env = {}) {
  const calls = [];
  let reply = { status: 201, body: { id: 'saved-42', status: 'received' } };
  const cms = http.createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk;
    calls.push({ url: request.url, headers: request.headers, body: JSON.parse(body) });
    response.writeHead(reply.status, { 'content-type': 'application/json' }).end(JSON.stringify(reply.body));
  });
  await new Promise(resolve => cms.listen(0, '127.0.0.1', resolve));
  try {
    await withEnvironment({ STRAPI_PUBLIC_URL: `http://127.0.0.1:${cms.address().port}`, STRAPI_SERVER_TOKEN: 'private-server-secret', TURNSTILE_SITE_KEY: '', TRUST_PROXY: 'false', ...env }, async () => {
      const { POST } = load('app/api/inquiries/route.js');
      const submit = (value = valid, headers = {}) => POST(new Request('http://localhost/api/inquiries', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof value === 'string' ? value : JSON.stringify(value) }));
      await run({ submit, calls, reply: value => reply = value });
    });
  } finally { cms.closeAllConnections(); await new Promise(resolve => cms.close(resolve)); }
}

test('proxy rejects malformed input before contacting CMS and reports approved field errors', async () => {
  await withRoute(async ({ submit, calls }) => {
    for (const input of [null, '{bad', { ...valid, website: 'spam' }]) assert.equal((await submit(input)).status, 400);
    const response = await submit({ ...valid, email: 'wrong' });
    assert.equal(response.status, 400); assert.ok((await response.json()).errors.email);
    assert.equal(calls.length, 0);
  });
});

test('proxy sends normalized public fields, selected context and server authentication only', async () => {
  await withRoute(async ({ submit, calls }) => {
    const response = await submit();
    assert.equal(response.status, 201); assert.deepEqual(await response.json(), { id: 'saved-42', status: 'received' });
    assert.equal(calls[0].url, '/api/inquiries/submit');
    assert.equal(calls[0].headers.authorization, 'Bearer private-server-secret');
    assert.deepEqual(calls[0].body, { name: 'Alex', email: 'alex@example.com', whatsapp: '', country: 'UK', productType: 'module-b', quantity: '', message: 'Six modules', source: 'homepage:Hospitality', website: '' });
  });
});

test('chatbox phone-only leads reach CMS with source and transcript; invalid contact saves nothing', async () => {
  await withRoute(async ({ submit, calls }) => {
    const input = { ...valid, source: 'chatbox:fr:/products/modular-buildings', email: '', whatsapp: '+33 (612) 345-678', message: 'Bonjour\n\nSix houses, please.' };
    assert.equal((await submit({ ...input, whatsapp: '' })).status, 400);
    assert.equal((await submit({ ...input, whatsapp: 'not a phone' })).status, 400);
    assert.equal(calls.length, 0);
    assert.equal((await submit(input)).status, 201);
    assert.equal(calls[0].body.whatsapp, '+33612345678');
    assert.equal(calls[0].body.email, '');
    assert.equal(calls[0].body.source, input.source);
    assert.equal(calls[0].body.message, input.message);
  });
});

test('only a confirmed saved receipt yields success and all untrusted failures stay generic', async () => {
  await withRoute(async ({ submit, reply }) => {
    for (const body of [{}, { id: ' ', status: 'received' }, { id: 42, status: 'received' }, { id: '42', status: 'new' }]) {
      reply({ status: 200, body }); assert.equal((await submit()).status, 502);
    }
    reply({ status: 500, body: { error: { message: 'private-server-secret database internals' } } });
    const response = await submit(); assert.equal(response.status, 502);
    assert.equal(JSON.stringify(await response.json()).includes('private-server-secret'), false);
  });
});

test('Strapi nested field errors are mapped without exposing internal values; rate limits stay 429', async () => {
  await withRoute(async ({ submit, reply }) => {
    reply({ status: 400, body: { error: { message: 'private-server-secret', details: { errors: { country: 'private-server-secret', internalNotes: 'private-server-secret' } } } } });
    const response = await submit(); assert.equal(response.status, 400);
    const body = await response.json(); assert.ok(body.errors.country); assert.equal(body.errors.internalNotes, undefined);
    assert.equal(JSON.stringify(body).includes('private-server-secret'), false);
    reply({ status: 429, body: { error: { message: 'private-server-secret' } } });
    const limited = await submit(); assert.equal(limited.status, 429); assert.equal(JSON.stringify(await limited.json()).includes('private-server-secret'), false);
  });
});

test('missing config yields 503; proof is separate, required and bounded only when enabled', async () => {
  await withRoute(async ({ submit, calls }) => { assert.equal((await submit()).status, 503); assert.equal(calls.length, 0); }, { STRAPI_SERVER_TOKEN: '' });
  await withRoute(async ({ submit, calls }) => {
    for (const turnstileToken of [undefined, '', 'x'.repeat(2049)]) assert.equal((await submit({ ...valid, turnstileToken })).status, 400);
    assert.equal(calls.length, 0);
    assert.equal((await submit({ ...valid, turnstileToken: 'proof-once' })).status, 201);
    assert.equal(calls[0].body.turnstileToken, 'proof-once');
  }, { TURNSTILE_SITE_KEY: 'runtime-public-key' });
});

test('direct service ignores forged forwarded IPs and cannot evade the per-instance quota', async () => {
  await withRoute(async ({ submit, calls }) => {
    for (let i = 1; i <= 5; i++) assert.equal((await submit(valid, { 'x-forwarded-for': `203.0.113.${i}` })).status, 201);
    assert.equal((await submit(valid, { 'x-forwarded-for': '203.0.113.6' })).status, 429);
    assert.equal(new Set(calls.map(call => call.headers['x-inquiry-client'])).size, 1);
  });
});

test('trusted proxy accepts one valid IPv4 or IPv6 and rejects chains and spoofed values', async () => {
  await withRoute(async ({ submit, calls }) => {
    for (const ip of ['203.0.113.15', '2001:db8::1', 'evil', '203.0.113.15, 203.0.113.16', '999.999.999.999']) assert.equal((await submit(valid, { 'x-forwarded-for': ip })).status, 201);
    assert.equal(calls[0].headers['x-inquiry-client'], '203.0.113.15');
    assert.equal(calls[1].headers['x-inquiry-client'], '2001:db8::1');
    assert.equal(calls[2].headers['x-inquiry-client'], calls[3].headers['x-inquiry-client']);
    assert.equal(calls[2].headers['x-inquiry-client'], calls[4].headers['x-inquiry-client']);
  }, { TRUST_PROXY: 'true' });
});
