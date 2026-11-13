// Run after build:web. All CMS reads and inquiry writes use an isolated local fixture.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON || import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('playwright-core')); }
const read = file => JSON.parse(fs.readFileSync(`packages/contracts/${file}`, 'utf8'));
const catalogue = read('company-products.json'), arabic = read('company-products.ar.json'), french = read('company-products.fr.json');
const image = fs.readFileSync('apps/web/public/products/company/d7-exterior-setting.webp');
const records = [], reads = [];
const fixtureProducts = locale => catalogue.products.map((product, index) => ({
  ...(locale === 'ar' ? arabic[product.slug] : locale === 'fr' ? french[product.slug] : product.en),
  slug: product.slug, categoryKey: product.slug === 'scb10-10kv-250kva' ? 'dry-type-transformers' : product.categoryKey, imageUrl: product.imageUrl, gallery: product.galleryUrls.map(url => ({ url })),
  featured: ['scb10-10kv-250kva', 'expandable-20ft'].includes(product.slug),
  ...(index < 2 ? { brochure: { url: '/uploads/catalogue.pdf' } } : {})
}));
const cms = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://fixture.invalid');
  const locale = url.searchParams.get('locale') || 'en';
  if (url.pathname.startsWith('/uploads/')) {
    if (url.pathname.endsWith('.pdf')) return response.writeHead(200, { 'content-type': 'application/pdf' }).end('%PDF-1.4\nFixture only');
    return response.writeHead(200, { 'content-type': 'image/webp' }).end(image);
  }
  response.setHeader('content-type', 'application/json');
  if (url.pathname === '/api/homepage') {
    reads.push({ path: url.pathname, locale });
    return response.end(JSON.stringify({ products: [], faqs: locale === 'fr' ? [] : [['Published FAQ', 'Published answer']], settings: {
      siteName: 'ZHUDUO', contactEmail: 'sales@example.org', footerNote: 'Published footer', whatsappNumber: '+44 1234567890', companyAddress: 'Published address', companyIntro: `Published company introduction (${locale})`,
      foundedYear: 2012, factoryArea: 6500, exportMarkets: 24, certificationCount: 3, factoryImageUrl: '/uploads/factory.webp', exhibitionName: 'Confirmed exhibition', exhibitionDetails: 'Published event details'
    }, cases: [{ title: 'Verified customer project', location: 'UK', productName: 'Modular office', quantity: '12 units', summary: 'Published project summary', imageUrl: '/uploads/case.webp' }],
    certificates: [{ title: 'Published certificate', url: '/uploads/certificate.pdf' }, { title: 'Published certificate image', url: '/uploads/certificate.webp', imageUrl: '/uploads/certificate.webp' }] }));
  }
  if (url.pathname === '/api/products') {
    reads.push({ path: url.pathname, locale });
    const all = fixtureProducts(locale), page = Number(url.searchParams.get('pagination[page]'));
    return response.end(JSON.stringify({ data: all.slice((page - 1) * 100, page * 100).map(product => ({ ...product, customizableOptions: product.options })), meta: { pagination: { page, pageSize: 100, pageCount: Math.ceil(all.length / 100), total: all.length } } }));
  }
  if (url.pathname === '/api/inquiries/submit') {
    assert.equal(request.headers.authorization, 'Bearer browser-fixture-token');
    let body = ''; for await (const chunk of request) body += chunk;
    const input = JSON.parse(body);
    if (input.turnstileToken !== 'browser-fixture-proof') return response.writeHead(400).end('{}');
    if (input.name === 'Missing acknowledgement') return response.end('{}');
    if (input.name === 'Upstream failure') return response.writeHead(500).end('{}');
    records.push(input);
    return response.writeHead(201).end(JSON.stringify({ id: `browser-${records.length}`, status: 'received' }));
  }
  response.writeHead(404).end('{}');
});
await new Promise(resolve => cms.listen(0, '127.0.0.1', resolve));
const port = Number(process.env.SITE_BROWSER_PORT || 3112), origin = `http://127.0.0.1:${port}`;
const web = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(port)], {
  cwd: path.resolve('apps/web'), env: { ...process.env, NODE_ENV: 'production', SITE_PREVIEW_MODE: '', STRAPI_PUBLIC_URL: `http://127.0.0.1:${cms.address().port}`, STRAPI_SERVER_TOKEN: 'browser-fixture-token', TURNSTILE_SITE_KEY: 'browser-fixture-site-key', TRUST_PROXY: 'false', NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe']
});
let log = ''; web.stdout.on('data', chunk => { log += chunk; }); web.stderr.on('data', chunk => { log += chunk; });
let browser;
const output = path.resolve('output/formal-site'); fs.mkdirSync(output, { recursive: true });
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (web.exitCode !== null) throw new Error(log);
    try { ready = (await fetch(`${origin}/api/health`)).ok; } catch {}
    if (ready) break;
    await delay(200);
  }
  assert.ok(ready, log);
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, reducedMotion: 'reduce' });
  await context.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', route => route.fulfill({ contentType: 'application/javascript', body: `
    window.__widgets = new Map();
    window.__nextWidgetId = 0;
    window.turnstile = {
      render: (element, options) => { const id = String(window.__nextWidgetId++); window.__widgets.set(id, options); element.textContent = 'Local verification fixture'; return id; },
      reset: id => window.__widgets.get(id)?.['expired-callback']?.(),
      remove: id => window.__widgets.delete(id)
    };
    window.__solveChallenge = () => window.__widgets.forEach(options => options.callback('browser-fixture-proof'));
  ` }));
  const page = await context.newPage(), errors = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/inquiries') writes.push(request.url()); });
  async function open(url = '/?lang=en') {
    assert.equal((await page.goto(`${origin}${url}`, { waitUntil: 'networkidle' })).status(), 200, url);
    await page.evaluate(() => document.fonts.ready);
  }
  async function layout(label) {
    const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
    assert.ok(widths.scroll <= widths.viewport + 1, `${label}: ${JSON.stringify(widths)}`);
    assert.equal(await page.locator('html').getAttribute('dir'), 'ltr');
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(resolve => setTimeout(resolve, 15)); } scrollTo(0, 0); });
    await page.waitForFunction(() => [...document.images].every(image => image.complete));
    assert.deepEqual(await page.locator('img').evaluateAll(images => images.filter(image => !image.naturalWidth).map(image => image.src)), [], label);
  }
  await open();
  assert.deepEqual(await page.locator('.hp-nav-item-row>a').allTextContents(), ['Electrical Equipment', 'Modular Buildings', 'Applications', 'Projects', 'Resources', 'About Us']);
  assert.equal(await page.locator('.hp-hero-caption').innerText().then(text => text.includes('preview')), false);
  assert.ok((await page.locator('.hp-about-copy').innerText()).includes('Published company introduction (en)'));
  assert.deepEqual(await page.locator('.hp-stat strong').allTextContents(), ['2012', '6,500m²', '3']);
  assert.deepEqual(await page.locator('.hp-market-flags-group:not([aria-hidden]) img').evaluateAll(images => images.map(image => image.getAttribute('src'))), ['/flags/fr.svg', '/flags/sa.svg', '/flags/gb.svg']);
  assert.equal(await page.locator('.hp-case').count(), 1);
  assert.equal(await page.locator('.hp-certificate-document').count(), 2);
  assert.equal(await page.locator('.hp-chat-launcher').innerText(), 'WhatsApp');
  assert.equal(await page.locator('.hp-chat-panel').isVisible(), false);
  assert.equal(await page.locator('.hp-contact-methods a[href="https://wa.me/441234567890"]').count(), 1);
  const paths = new Set([await page.locator('.hp-header .brand').getAttribute('href'), ...await page.locator('.hp-nav-item-row>a').evaluateAll(links => links.map(link => link.getAttribute('href')))]);
  for (let index = 0; index < await page.locator('.hp-nav-toggle').count(); index++) {
    const toggle = page.locator('.hp-nav-toggle').nth(index);
    await toggle.focus(); await page.keyboard.press('Enter');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    for (const href of await page.locator('.hp-nav-dropdown a').evaluateAll(links => links.map(link => link.getAttribute('href')))) paths.add(href);
    await page.keyboard.press('Escape');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  }
  assert.equal(paths.size, 36);
  for (const href of paths) assert.equal((await context.request.get(origin + href)).status(), 200, href);
  for (const [old, target] of [
    ['/products/modular-housing/expandable-homes/expandable-20ft?lang=ar', '/products/modular-buildings/expandable-houses/expandable-20ft?lang=ar'],
    ['/products/electrical/distribution-transformers/scb10-10kv-250kva?lang=fr', '/products/electrical/transformers/dry-type-transformers/scb10-10kv-250kva?lang=fr'],
    ['/products/modular-housing/solar-homes?lang=en', '/products/modular-buildings/solar-homes?lang=en']
  ]) {
    const response = await context.request.get(origin + old, { maxRedirects: 0 });
    assert.equal(response.status(), 308, old); assert.equal(response.headers().location, target);
    await page.goto(origin + old, { waitUntil: 'networkidle' });
    await page.waitForURL(origin + target);
  }
  for (const url of ['/products/electrical/transformers/power-transformers/expandable-20ft', '/products/electrical/power-transformers/expandable-20ft', '/products/modular-buildings/expandable-houses/unpublished', '/resources/unknown']) {
    assert.equal((await context.request.get(origin + url)).status(), 404, url);
    await page.goto(origin + url, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('h1').innerText(), 'Page not found.');
    assert.ok(await page.locator('meta[name=robots][content*=noindex]').count());
  }
  console.log('PASS: 36 formal destinations, published CMS content, canonical legacy redirects and mismatched/unpublished 404s.');

  await open('/products/electrical?lang=en');
  const search = page.locator('.hp-catalogue-toolbar input');
  await search.fill('scb10-10kv-250kva'); assert.equal(await page.locator('.hp-product-card').count(), 1);
  assert.ok((await page.locator('.hp-product-image').getAttribute('href')).includes('/transformers/dry-type-transformers/'));
  await search.fill('no-such-model'); assert.equal(await page.locator('.hp-product-card').count(), 0);
  await search.fill(''); const first = await page.locator('.hp-product-image').first().getAttribute('href');
  await page.locator('.hp-pagination button').last().click();
  assert.notEqual(await page.locator('.hp-product-image').first().getAttribute('href'), first);
  await open('/products/electrical/transformers/special-transformers?lang=en'); assert.equal(await page.locator('.hp-empty').count(), 1);
  await open('/products/modular-buildings/solar-homes?lang=en'); assert.ok((await page.locator('h1').innerText()).trim());
  await open('/resources/product-catalogues?lang=en'); assert.equal(await page.locator('.hp-download-list a[href$="catalogue.pdf"]').count(), 1);
  await open('/resources/technical-documents?lang=en'); assert.ok(await page.locator('.hp-download-list a[href$="#product-specifications"]').count() > 100);
  await open('/resources/faqs?lang=en'); assert.equal(await page.locator('.hp-resource-faq details').count(), 1); assert.equal(await page.locator('details[open]').count(), 0);
  await page.locator('.hp-resource-faq summary').click(); assert.equal(await page.locator('details[open]').count(), 1);
  await open('/resources/faqs?lang=fr'); assert.equal(await page.locator('.hp-resource-faq details').count(), 0); assert.equal(await page.locator('.hp-resource-faq a[href="/contact?lang=fr"]').count(), 1);

  for (const language of ['en', 'ar', 'fr']) {
    for (const width of [1440, 1100, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 950 }); await open(`/?lang=${language}`); await layout(`${language} ${width}`);
      const panels = await page.locator('.hp-hero-panel').evaluateAll(items => items.map(item => item.getBoundingClientRect().x));
      if (width >= 850) assert.ok(panels[0] < panels[1], 'Housing stays left of electrical');
      if (width === 1440 || width === 390) await page.screenshot({ path: path.join(output, `home-${language}-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 950 }); await open(`/products/modular-buildings/expandable-houses/expandable-20ft?lang=${language}`); await layout(`detail ${language}`);
    const container = await page.locator('.pd-title').boundingBox(), inquiryContainer = await page.locator('.hp-contact-grid').boundingBox();
    assert.ok(Math.abs(container.x - inquiryContainer.x) < 1 && Math.abs(container.width - inquiryContainer.width) < 1);
    assert.equal(await page.locator('.pd-faq details[open]').count(), 0);
    assert.equal(await page.locator('.pd-project,.pd-inline-inquiry').count(), 0);
    assert.equal(await page.locator('#contact .hp-contact-faq .pd-faq details').count(), 4);
    assert.equal(await page.locator('#hp-main .inquiry-form').count(), 1);
    assert.equal(await page.locator('#contact [name=productType]').inputValue(), 'expandable-20ft');
    assert.equal(await page.locator('#contact [name=quantity]').count(), 1);
    assert.ok((await page.locator('.pd-breadcrumb a').nth(1).getAttribute('href')).startsWith('/products/modular-buildings?'));
    await page.setViewportSize({ width: 390, height: 950 }); await layout(`detail mobile ${language}`);
  }
  assert.ok(reads.some(read => read.locale === 'ar' && read.path === '/api/products'));
  assert.ok(reads.some(read => read.locale === 'fr' && read.path === '/api/products'));
  console.log('PASS: search/pagination, brochure downloads, FAQ states, en/ar/fr desktop and mobile layouts, images and detail pages.');

  await page.setViewportSize({ width: 1440, height: 950 }); await open();
  const trigger = page.locator('.language-trigger'); await trigger.hover(); assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
  const menu = await page.locator('.language-menu').boundingBox(), button = await trigger.boundingBox();
  await page.mouse.move(button.x + 30, button.y + button.height + 4); await page.waitForTimeout(200); assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
  await page.mouse.move(menu.x + 20, menu.y + 15); assert.equal(await page.locator('[role=menu]').count(), 1);
  await page.keyboard.press('Escape'); assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
  await trigger.focus(); await page.keyboard.press('ArrowDown'); assert.equal(await page.locator('[role=menuitemradio]:focus').count(), 1);
  await page.keyboard.press('Escape');
  await trigger.hover(); await page.locator('[role=menuitemradio][lang=fr]').click(); await page.waitForURL('**/?lang=fr'); await page.waitForFunction(() => document.documentElement.lang === 'fr');
  await page.setViewportSize({ width: 390, height: 950 }); await open(); await page.locator('.hp-menu-button').click();
  await page.locator('.hp-nav-toggle').first().click(); assert.equal(await page.locator('.hp-nav-toggle').first().getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); assert.equal(await page.locator('.hp-menu-button').getAttribute('aria-expanded'), 'false');

  await page.setViewportSize({ width: 1440, height: 950 }); await open();
  const form = page.locator('.hp-inquiry-card .inquiry-form');
  async function fill(form, name) {
    await form.locator('[name=name]').fill(name); await form.locator('[name=email]').fill('browser@example.org');
    await form.locator('[name=country]').fill('United Kingdom'); await form.locator('[name=message]').fill('Twelve units with project specifications');
  }
  async function send(form, name, status) {
    await fill(form, name); await page.waitForFunction(() => typeof window.__solveChallenge === 'function'); await page.evaluate(() => window.__solveChallenge());
    const receipt = page.waitForResponse(response => new URL(response.url()).pathname === '/api/inquiries');
    await form.locator('[type=submit]').click(); assert.equal((await receipt).status(), status);
  }
  assert.equal(await form.locator('[type=submit]').isDisabled(), true);
  assert.equal(await form.locator('[name=quantity]').count(), 0);
  await form.locator('.direction-trigger').click(); await page.locator('.direction-option').filter({ hasText: 'Power Transformers' }).first().click();
  await send(form, 'Browser received', 201); await page.locator('.hp-form-success').waitFor();
  assert.equal(records[0].productType, 'power-transformers'); assert.equal(records[0].source, 'site:/');
  await page.locator('.hp-form-success button').click();
  await send(form, 'Missing acknowledgement', 502); await page.locator('.hp-inquiry-card .form-status.error').waitFor(); assert.equal(await page.locator('.hp-form-success').count(), 0);
  await send(form, 'Upstream failure', 502); assert.equal(await page.locator('.hp-form-success').count(), 0); assert.equal(records.length, 1);
  await open('/products/modular-buildings/expandable-houses/expandable-20ft?lang=en');
  const detailForm = page.locator('#contact .inquiry-form'); await send(detailForm, 'Product inquiry received', 201); await page.locator('#contact .hp-form-success').waitFor(); assert.equal(records[1].productType, 'expandable-20ft');
  await page.locator('.hp-chat-launcher').click();
  await page.locator('.hp-chat-composer textarea').fill('Please send the house specifications.');
  await page.locator('.hp-chat-composer textarea').press('Enter');
  await page.locator('.hp-chat-contact [name=name]').fill('Chat visitor');
  await page.locator('.hp-chat-contact [name=country]').fill('France');
  await page.waitForFunction(() => [...window.__widgets.values()].some(options => options.size === 'compact'));
  assert.equal(await page.locator('.hp-chat-submit').isDisabled(), true);
  await page.evaluate(() => window.__solveChallenge());
  await page.locator('.hp-chat-submit').click();
  assert.equal(await page.locator('.hp-chat-confirmation').count(), 0);
  assert.equal(records.length, 2, 'missing contact creates no inquiry');
  await page.locator('.hp-chat-contact [name=whatsapp]').fill('+33 (612) 345-678');
  const chatReceipt = page.waitForResponse(response => new URL(response.url()).pathname === '/api/inquiries');
  await page.locator('.hp-chat-submit').click(); assert.equal((await chatReceipt).status(), 201);
  await page.locator('.hp-chat-confirmation').waitFor();
  assert.equal(records[2].email, ''); assert.equal(records[2].whatsapp, '+33612345678');
  assert.equal(records[2].productType, 'expandable-20ft'); assert.ok(records[2].source.startsWith('chatbox:en:/products/'));
  assert.equal(await page.locator('#cloudflare-turnstile-script').count(), 1, 'chat and forms share one script');
  const before = writes.length;
  await open('/preview/homepage?lang=en'); const previewForm = page.locator('.hp-form');
  await previewForm.locator('[name=name]').fill('Preview only'); await previewForm.locator('[name=email]').fill('preview@example.org'); await previewForm.locator('[name=message]').fill('Preview only');
  await previewForm.locator('[type=submit]').click(); await page.locator('.hp-form-success').waitFor(); assert.equal(writes.length, before); assert.equal(records.length, 3);
  assert.equal(await page.locator('.turnstile-widget').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: hover/keyboard/mobile menus, real acknowledged inquiries, visible upstream failures, verification requirement, product context and write-free review.');
} catch (error) {
  fs.writeFileSync(path.join(output, 'next.log'), log); throw error;
} finally {
  if (browser) await browser.close(); web.kill(); cms.closeAllConnections(); await new Promise(resolve => cms.close(resolve));
}
