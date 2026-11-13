// Run after build:web. The real vendor SDK runs against intercepted endpoints only.
// OKKI_SDK_PATH can pin a previously downloaded public SDK for an offline rerun.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON || import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('playwright-core')); }
const sdkUrl = 'https://tfile.xiaoman.cn/okki/analyze.js?id=528096-34388';
const sdk = process.env.OKKI_SDK_PATH ? fs.readFileSync(process.env.OKKI_SDK_PATH, 'utf8') : await (async () => {
  const response = await fetch(sdkUrl);
  assert.ok(response.ok, 'Read the public SDK without executing it outside the intercepted browser');
  return response.text();
})();
assert.ok(sdk.includes('target-sdk-ignore'), 'SDK ignore contract changed; review integration');
const catalogue = JSON.parse(fs.readFileSync('packages/contracts/company-products.json', 'utf8'));
const translations = Object.fromEntries(['fr', 'ar'].map(locale => [locale, JSON.parse(fs.readFileSync(`packages/contracts/company-products.${locale}.json`, 'utf8'))]));
const product = catalogue.products.find(product => product.slug === 'expandable-40ft');
assert.ok(product);
const records = [];
const cms = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://fixture.invalid');
  const locale = url.searchParams.get('locale') || 'en';
  response.setHeader('content-type', 'application/json');
  if (url.pathname === '/api/homepage') return response.end(JSON.stringify({ products: [], faqs: [], settings: { siteName: 'ZHUDUO', contactEmail: 'sales@website-test.invalid', footerNote: 'Fixture' }, cases: [], certificates: [] }));
  if (url.pathname === '/api/products') return response.end(JSON.stringify({ data: [{ ...(translations[locale]?.[product.slug] || product.en), slug: product.slug, categoryKey: product.categoryKey, imageUrl: product.imageUrl, gallery: product.galleryUrls.map(url => ({ url })) }], meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: 1 } } }));
  if (url.pathname === '/api/project-cases/slug/local-project') return response.end(JSON.stringify({ data: { slug: 'local-project', documentId: 'fixture-project', locale, publishedAt: '2026-11-06T00:00:00Z', isVerified: true, title: 'Local fixture project', productName: '40FT expandable house', quantity: '100' } }));
  if (url.pathname === '/api/inquiries/submit') {
    assert.equal(request.headers.authorization, 'Bearer okki-browser-fixture');
    let body = ''; for await (const chunk of request) body += chunk;
    const input = JSON.parse(body);
    assert.equal(input.turnstileToken, 'okki-fixture-proof');
    records.push(input);
    return response.writeHead(201).end(JSON.stringify({ id: `fixture-${records.length}`, status: 'received' }));
  }
  response.writeHead(404).end('{}');
});
await new Promise(resolve => cms.listen(0, '127.0.0.1', resolve));
const port = Number(process.env.OKKI_BROWSER_PORT || 3114), local = `http://127.0.0.1:${port}`;
const web = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(port)], {
  cwd: path.resolve('apps/web'), env: { ...process.env, NODE_ENV: 'production', SITE_PREVIEW_MODE: '', STRAPI_PUBLIC_URL: `http://127.0.0.1:${cms.address().port}`, STRAPI_SERVER_TOKEN: 'okki-browser-fixture', TURNSTILE_SITE_KEY: 'okki-fixture-key', TRUST_PROXY: 'true', NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe']
});
let log = '', browser, visitor = 1;
web.stdout.on('data', chunk => { log += chunk; }); web.stderr.on('data', chunk => { log += chunk; });
const output = path.resolve('output/okki'); fs.mkdirSync(output, { recursive: true });
const results = [];
const eventData = event => Object.fromEntries(Object.entries(event).filter(([key]) => key.startsWith('d.')).map(([key, value]) => [key.slice(2), value]));
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (web.exitCode !== null) throw new Error(log);
    try { ready = (await fetch(`${local}/api/health`)).ok; } catch {}
    if (ready) break;
    await delay(200);
  }
  assert.ok(ready, log);
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
  async function session({ host = 'www.bjzdbuilding.com', brokenSdk = false } = {}) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const events = [], errors = [], unexpected = [];
    let scriptRequests = 0;
    const origin = host === '127.0.0.1' ? local : `https://${host}`;
    // One catch-all handler prevents beacons, vendor diagnostics and widgets from
    // ever reaching the network. Site requests use local Next + fixture CMS only.
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin === origin) {
        const response = await fetch(`${local}${url.pathname}${url.search}`, {
          method: request.method(), headers: { ...request.headers(), host: `127.0.0.1:${port}`, 'x-forwarded-for': `203.0.113.${visitor++}` },
          ...(request.postDataBuffer() ? { body: request.postDataBuffer() } : {}), redirect: 'manual'
        });
        const headers = Object.fromEntries(response.headers); delete headers['content-encoding']; delete headers['content-length'];
        return route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) });
      }
      if (url.href === sdkUrl) {
        scriptRequests++;
        return brokenSdk ? route.abort('failed') : route.fulfill({ contentType: 'application/javascript', body: sdk });
      }
      const cors = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' };
      if (url.hostname === 'rt.xiaoman.cn' && url.pathname === '/api/interface/siteSetting') return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ data: { event_report_flag: true, ga_report_flag: false, live_chat: 0, identity_id: 'fixture', session_id: 'fixture', site_session_id: 'fixture' } }) });
      if (url.hostname === 'rt.xiaoman.cn' && url.pathname.endsWith('/report')) {
        const params = new URLSearchParams(request.postData() || url.search);
        events.push(Object.fromEntries(params));
        return route.fulfill({ headers: cors, contentType: 'application/json', body: '{}' });
      }
      if (url.hostname === 'challenges.cloudflare.com') return route.fulfill({ contentType: 'application/javascript', body: `window.__widgets = new Map(); window.turnstile = { render: (el, options) => { const id = String(window.__widgets.size); window.__widgets.set(id, options); return id; }, reset: () => {}, remove: id => window.__widgets.delete(id) }; window.__solve = () => window.__widgets.forEach(options => options.callback('okki-fixture-proof'));` });
      unexpected.push(url.origin + url.pathname);
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    const open = async pathname => {
      assert.equal((await page.goto(`${origin}${pathname}`, { waitUntil: 'networkidle' })).status(), 200);
      if (host !== '127.0.0.1' && !pathname.startsWith('/preview') && !brokenSdk) await page.waitForFunction(() => Boolean(window.okkiSiteSetting));
    };
    const forms = () => events.filter(event => event.t === 'form');
    const close = async () => { assert.deepEqual(errors, []); assert.deepEqual(unexpected, []); await context.close(); };
    return { page, context, events, forms, open, close, scriptRequests: () => scriptRequests };
  }
  async function fill(form, email, choose = true) {
    await form.locator('[name=name]').fill('OKKI local verification');
    await form.locator('[name=email]').fill(email);
    await form.locator('[name=country]').fill('Australia');
    await form.locator('[name=message]').fill('Please quote 100 expandable houses. Local intercepted test.');
    if (choose) {
      await form.locator('.direction-trigger').click();
      await form.locator('.direction-tabs [role=tab]').nth(1).click();
      await form.locator('.direction-option').filter({ hasText: /40/ }).click();
    }
  }
  async function send(page, form) {
    await page.waitForFunction(() => typeof window.__solve === 'function');
    await page.evaluate(() => window.__solve());
    const receipt = page.waitForResponse(response => new URL(response.url()).pathname === '/api/inquiries');
    await form.locator('[type=submit]').click(); assert.equal((await receipt).status(), 201);
  }
  for (const language of ['en', 'fr', 'ar']) {
    const s = await session(); await s.open(`/?lang=${language}`);
    await s.page.evaluate(() => { window.__documentMarker = true; });
    // Test an actual Next client navigation: SDK must not be initialized twice.
    await s.page.locator(`.hp-nav-item-row>a[href="/contact?lang=${language}"]`).click();
    await s.page.waitForURL(`**/contact?lang=${language}`);
    assert.equal(await s.page.evaluate(() => window.__documentMarker), true);
    const form = s.page.locator('.hp-inquiry-card .inquiry-form');
    await fill(form, `ordinary-${language}@website-test.invalid`);
    assert.deepEqual(await form.locator('.okki-form-context input').evaluateAll(inputs => inputs.map(input => ({ height: input.clientHeight > 0, tabbable: input.tabIndex >= 0 }))), Array(3).fill({ height: true, tabbable: false }));
    await s.page.screenshot({ path: path.join(output, `contact-${language}-form.png`) });
    await send(s.page, form);
    await s.page.waitForFunction(() => Boolean(document.querySelector('.hp-form-success')));
    await delay(300);
    assert.equal(s.scriptRequests(), 1); assert.equal(s.forms().length, 1);
    const captured = eventData(s.forms()[0]);
    assert.equal(captured.email, `ordinary-${language}@website-test.invalid`);
    assert.match(captured.product, /40.*\(expandable-40ft\)/);
    assert.equal(captured.inquirySource, 'site:/contact'); assert.equal(captured.inquiryLanguage, language);
    assert.equal(captured.message, records.at(-1).message);
    assert.equal(records.at(-1).productType, 'expandable-40ft'); assert.equal(records.at(-1).source, 'site:/contact');
    assert.equal(records.at(-1).inquiryLanguage, undefined);
    await s.page.screenshot({ path: path.join(output, `contact-${language}.png`) });
    results.push(`${language}: one SDK, one ordinary form capture + CMS receipt, product/source/language intact`);
    await s.close();
  }
  {
    const s = await session({ host: 'bjzdbuilding.com' });
    await s.open('/products/modular-buildings/expandable-houses/expandable-40ft?lang=en');
    const form = s.page.locator('#contact .inquiry-form');
    await fill(form, 'product@website-test.invalid', false); await send(s.page, form); await delay(300);
    assert.equal(s.forms().length, 1);
    assert.equal(eventData(s.forms()[0]).inquirySource, 'catalogue:/products/modular-buildings/expandable-houses/expandable-40ft');
    assert.equal(records.at(-1).productType, 'expandable-40ft');
    results.push('apex domain + product details: selected model and product page source captured'); await s.close();
  }
  {
    const s = await session(); await s.open('/projects/featured-projects/local-project?lang=en');
    await s.page.setViewportSize({ width: 390, height: 844 });
    const form = s.page.locator('.prj-contact .inquiry-form');
    await fill(form, 'project@website-test.invalid'); await send(s.page, form); await form.locator('.form-status.success').waitFor();
    assert.equal(s.forms().length, 1); assert.equal(eventData(s.forms()[0]).inquirySource, 'project:/projects/featured-projects/local-project');
    assert.equal(records.at(-1).source, 'project:/projects/featured-projects/local-project');
    assert.ok(await s.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    results.push('mobile project detail: one form capture and correct project source saved'); await s.close();
  }
  {
    const s = await session(); await s.open('/?lang=en');
    await s.page.locator('.hp-chat-launcher').click();
    await s.page.locator('.hp-chat-composer textarea').fill('We need 100 houses.');
    await s.page.locator('.hp-chat-composer [type=submit]').click();
    const form = s.page.locator('.hp-chat-contact');
    for (const [name, value] of Object.entries({ name: 'Chat local test', country: 'France', email: 'chat@website-test.invalid' })) await form.locator(`[name=${name}]`).fill(value);
    await send(s.page, form); await s.page.locator('.hp-chat-confirmation').waitFor(); await delay(5500);
    assert.equal(s.forms().length, 0, 'Chatbox must not produce a partial ordinary CRM lead');
    assert.match(records.at(-1).source, /^chatbox:en:/);
    results.push('Chatbox saves to CMS with conversation; zero OKKI form reports'); await s.close();
  }
  for (const options of [{ host: '127.0.0.1' }, { brokenSdk: true }]) {
    const s = await session(options); await s.open('/contact?lang=en');
    const form = s.page.locator('.inquiry-form'); await fill(form, 'offline@website-test.invalid'); await send(s.page, form);
    await s.page.locator('.hp-form-success').waitFor(); assert.equal(s.forms().length, 0);
    assert.equal(s.scriptRequests(), options.brokenSdk ? 1 : 0);
    results.push(options.brokenSdk ? 'SDK load failure: CMS save still succeeds' : 'localhost: no SDK requests, CMS save unaffected'); await s.close();
  }
  {
    const s = await session(); const before = records.length; await s.open('/preview/homepage?lang=en');
    assert.equal(s.scriptRequests(), 0);
    const form = s.page.locator('.hp-form');
    await form.locator('[name=name]').fill('Preview'); await form.locator('[name=email]').fill('preview@website-test.invalid'); await form.locator('[name=message]').fill('Preview only');
    await form.locator('[type=submit]').click(); await s.page.locator('.hp-form-success').waitFor();
    assert.equal(records.length, before); assert.equal(s.forms().length, 0);
    results.push('direct preview: no SDK, no CMS write'); await s.close();
  }
  {
    const s = await session(); await s.open('/preview/projects/sample-project?lang=en'); const before = records.length;
    // A real Link to the formal list, followed by browser Back, keeps the same
    // document and SDK alive while restoring the preview's demo form.
    await s.page.evaluate(() => { window.__documentMarker = true; });
    await s.page.locator('.prj-back').click(); await s.page.waitForURL('**/projects/featured-projects?lang=en');
    await s.page.waitForFunction(() => Boolean(window.okkiSiteSetting));
    await s.page.goBack(); await s.page.waitForURL('**/preview/projects/sample-project?lang=en');
    assert.equal(await s.page.evaluate(() => window.__documentMarker), true);
    const form = s.page.locator('.prj-contact .inquiry-form'); await fill(form, 'client-preview@website-test.invalid', false);
    await form.locator('[type=submit]').click(); await form.locator('.form-status.success').waitFor(); await delay(5500);
    assert.equal(records.length, before); assert.equal(s.forms().length, 0);
    results.push('client navigation to preview: existing SDK ignores demo form'); await s.close();
  }
  const report = { sdkSha256: createHash('sha256').update(sdk).digest('hex'), recordsSavedToFixtureOnly: records.length, results };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close(); web.kill(); cms.closeAllConnections(); await new Promise(resolve => cms.close(resolve));
}
