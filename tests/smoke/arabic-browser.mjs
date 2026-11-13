// Production web build against an isolated CMS fixture; no real CMS writes.
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
const catalogue = JSON.parse(fs.readFileSync('packages/contracts/company-products.json', 'utf8'));
const arabic = JSON.parse(fs.readFileSync('packages/contracts/company-products.ar.json', 'utf8'));
const arContent = JSON.parse(fs.readFileSync('packages/contracts/site-content.ar.json', 'utf8'));
const french = JSON.parse(fs.readFileSync('packages/contracts/company-products.fr.json', 'utf8'));
const frContent = JSON.parse(fs.readFileSync('packages/contracts/site-content.fr.json', 'utf8'));
const english = JSON.parse(fs.readFileSync('packages/contracts/demo-content.json', 'utf8'));
const records = [], reads = [], issues = [];
const products = locale => catalogue.products.map(product => ({ ...(locale === 'ar' ? arabic[product.slug] : locale === 'fr' ? french[product.slug] : product.en), slug: product.slug, categoryKey: product.categoryKey, customizableOptions: (locale === 'ar' ? arabic[product.slug] : locale === 'fr' ? french[product.slug] : product.en).options, imageUrl: product.imageUrl, gallery: (product.galleryUrls || []).map(url => ({ url })) }));
const cms = http.createServer(async (request, response) => {
  response.setHeader('content-type', 'application/json');
  const url = new URL(request.url, 'http://fixture');
  const locale = url.searchParams.get('locale');
  if (url.pathname === '/api/homepage' || url.pathname === '/api/products') {
    assert.ok(['en', 'ar', 'fr'].includes(locale), `Unexpected public locale: ${locale}`);
    reads.push(locale);
    const rows = products(locale);
    const content = locale === 'ar' ? arContent : locale === 'fr' ? frContent : english;
    if (url.pathname === '/api/homepage') return response.end(JSON.stringify({ products: rows.slice(0, 12).map(row => ({ ...row, options: row.customizableOptions })), faqs: content.faqs, settings: content.settings }));
    const page = Number(url.searchParams.get('pagination[page]') || 1);
    return response.end(JSON.stringify({ data: rows.slice((page - 1) * 100, page * 100), meta: { pagination: { page, pageSize: 100, pageCount: Math.ceil(rows.length / 100), total: rows.length } } }));
  }
  if (url.pathname === '/api/inquiries/submit') {
    assert.equal(request.headers.authorization, 'Bearer arabic-browser-fixture');
    let body = '';
    for await (const chunk of request) body += chunk;
    const record = JSON.parse(body);
    if (record.name === 'Fail') return response.writeHead(500).end('{}');
    records.push(record);
    return response.writeHead(201).end(JSON.stringify({ id: `fixture-${records.length}`, status: 'received' }));
  }
  response.writeHead(404).end('{}');
});
await new Promise(resolve => cms.listen(0, '127.0.0.1', resolve));
const port = Number(process.env.ARABIC_WEB_PORT || 3112);
const base = `http://127.0.0.1:${port}`;
const web = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(port)], {
  cwd: path.resolve('apps/web'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'production', SITE_PREVIEW_MODE: '', STRAPI_PUBLIC_URL: `http://127.0.0.1:${cms.address().port}`, STRAPI_SERVER_TOKEN: 'arabic-browser-fixture', TURNSTILE_SITE_KEY: '', TRUST_PROXY: 'true' }
});
let logs = '', browser;
web.stdout.on('data', data => logs += data);
web.stderr.on('data', data => logs += data);
fs.mkdirSync('output/site-arabic', { recursive: true });
async function settled(page, language) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('html').getAttribute('lang'), language);
  assert.equal(await page.locator('html').getAttribute('dir'), 'ltr');
  assert.doesNotMatch(await page.locator('body').innerText(), /[\u3400-\u9fff]/);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Horizontal overflow: ${page.url()}`);
}
async function originalOrder(page, first, second, axis = 'x') {
  const a = await page.locator(first).first().boundingBox();
  const b = await page.locator(second).first().boundingBox();
  assert.ok(a && b, `Missing layout elements: ${first}, ${second}`);
  assert.ok(a[axis] + a[axis === 'x' ? 'width' : 'height'] <= b[axis] + 1, `Layout reversed or overlapping: ${first}, ${second}`);
}
async function originalHeader(page) {
  await originalOrder(page, '.nav-row .brand', '.nav-actions');
  assert.equal(await page.locator('.nav-row').evaluate(node => getComputedStyle(node).direction), 'ltr');
}
try {
  for (let attempt = 0; ; attempt++) {
    assert.ok(attempt < 100 && web.exitCode === null, logs);
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch {}
    await delay(200);
  }
  const html = await (await fetch(`${base}/?lang=ar`)).text();
  assert.match(html, /<html[^>]*lang="ar"[^>]*dir="ltr"/);
  const legacy = await fetch(`${base}/products/electrical?lang=zh`, { redirect: 'manual' });
  assert.equal(legacy.status, 308);
  assert.equal(new URL(legacy.headers.get('location')).searchParams.get('lang'), 'en');
  const missing = await fetch(`${base}/products/unknown?lang=ar`);
  // Next may already have streamed headers before resolving a dynamic not-found.
  assert.ok((await missing.text()).includes('الصفحة غير موجودة.'));
  browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  for (const [index, width] of [1440, 390, 320].entries()) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, extraHTTPHeaders: { 'x-forwarded-for': `198.51.100.${index + 70}` } });
    const page = await context.newPage();
    page.on('pageerror', error => issues.push(error.message));
    for (const language of ['en', 'fr', 'ar']) {
      await page.goto(`${base}/?lang=${language}`);
      await settled(page, language);
      await originalHeader(page);
      await originalOrder(page, '.division-hero-modular-housing', '.division-hero-electrical', width === 1440 ? 'x' : 'y');
      await originalOrder(page, '.about-photo', '.about-copy', width === 1440 ? 'x' : 'y');
      const floating = await page.locator('.floating').boundingBox();
      assert.ok(floating.x > width / 2, 'Floating inquiry button moved to the left');
      if (width === 1440) {
        await originalOrder(page, '#navigation > a:first-child', '.pv-product-nav');
        await originalOrder(page, '.project-grid > :nth-child(1)', '.project-grid > :nth-child(2)');
      }
      if (language === 'ar' && width === 1440) {
        assert.equal(await page.locator('.division-hero-copy h2').first().evaluate(node => getComputedStyle(node).direction), 'rtl');
        const client = await context.newCDPSession(page);
        await client.send('DOM.enable');
        await client.send('CSS.enable');
        const { root } = await client.send('DOM.getDocument');
        const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.division-hero-copy h2' });
        const { fonts } = await client.send('CSS.getPlatformFontsForNode', { nodeId });
        assert.ok(fonts.some(font => font.familyName.includes('Noto Sans Arabic') && font.isCustomFont && font.glyphCount > 0), JSON.stringify(fonts));
        await client.detach();
      }
      if (language === 'ar') {
        for (const selector of ['.faq-grid h2', '.faq-grid details p', '.contact h2', '.contact p', '.footer-grid p', '.footer-grid h3']) {
          assert.equal(await page.locator(selector).first().evaluate(node => getComputedStyle(node).textAlign), 'left', `Misaligned Arabic text: ${selector}`);
        }
        await page.locator('.faq-grid details').nth(2).locator('summary').click();
        assert.equal(await page.locator('.faq-grid details').nth(2).getAttribute('open'), '');
        await page.locator('.faq-grid details').nth(2).locator('summary').click();
        await page.locator('#home').scrollIntoViewIfNeeded();
      }
      await page.screenshot({ path: `output/site-arabic/home-${language}-${width}.png`, fullPage: true });
    }
    await page.locator('#language').click();
    assert.equal(await page.locator('#language-options button').count(), 3);
    assert.deepEqual(await page.locator('#language-options button').allTextContents(), ['English', 'العربية', 'Français']);
    await page.keyboard.press('Escape');
    if (width === 1440) {
      await page.locator('.pv-product-trigger').hover();
      await page.locator('.pv-nav-group').first().hover();
      await page.screenshot({ path: 'output/site-arabic/navigation-ar-1440.png' });
      const submenu = await page.locator('.pv-submenu:not([hidden])').boundingBox();
      assert.ok(submenu && submenu.x >= 0 && submenu.x + submenu.width <= width);
      await originalOrder(page, '.pv-cascade', '.pv-submenu:not([hidden])');
      assert.equal(await page.locator('.pv-sub-toggle').first().evaluate(node => getComputedStyle(node).transform), 'none');
    }
    for (const language of ['ar', 'fr']) {
    for (const division of ['electrical', 'modular-housing']) {
      await page.goto(`${base}/products/${division}?lang=${language}`);
      await settled(page, language);
      await originalHeader(page);
      await originalOrder(page, '.pv-sidebar', '.pv-catalogue-content', width === 1440 ? 'x' : 'y');
      await originalOrder(page, '.pv-product-card:nth-child(1)', '.pv-product-card:nth-child(2)');
      await page.screenshot({ path: `output/site-arabic/${division}-${language}-${width}.png`, fullPage: true });
      const detailHref = await page.locator('.pv-product-image').first().getAttribute('href');
      const firstSlug = await page.locator('.pv-product-card').first().getAttribute('data-product-slug');
      await page.locator('.pv-product-image').first().click();
      await page.waitForURL(`${base}${detailHref}`);
      await page.waitForSelector('.product-detail-page');
      await settled(page, language);
      assert.equal(await page.locator('.pv-info-dialog').count(), 0, 'Product information opens as a page');
      await originalOrder(page, '.pd-overview-copy', '.pd-gallery', width === 1440 ? 'x' : 'y');
      assert.equal(await page.locator('.pd-inline-inquiry input[name=productType]').inputValue(), firstSlug);
      await page.reload();
      await settled(page, language);
      assert.ok((await page.title()).includes(await page.locator('.pd-title h1').innerText()));
      if (division === 'modular-housing' && language === 'ar') {
        const measurement = page.locator('.pd-specification-table bdi').filter({ hasText: '5900 × 6320 × 2430 mm' }).first();
        assert.equal(await measurement.getAttribute('dir'), 'ltr');
        assert.equal(await measurement.evaluate(node => getComputedStyle(node).direction), 'ltr');
      }
      await page.screenshot({ path: `output/site-arabic/detail-${division}-${language}-${width}.png` });
      await page.locator('.pv-header-quote').click();
      await page.waitForSelector('.pv-inquiry[open]');
      assert.equal(await page.locator('.pv-inquiry input[name=productType]').inputValue(), firstSlug);
      await originalOrder(page, '.pv-inquiry input[name=name]', '.pv-inquiry input[name=email]', width === 320 ? 'y' : 'x');
      await page.locator('.pv-inquiry .direction-trigger').click();
      await page.waitForSelector('.direction-panel');
      const box = await page.locator('.direction-panel').boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1);
      await originalOrder(page, '.direction-tabs > button:nth-child(1)', '.direction-tabs > button:nth-child(2)');
      const tabs = page.locator('.direction-tabs > button');
      await tabs.first().click();
      await page.keyboard.press('ArrowRight');
      assert.equal(await tabs.nth(1).getAttribute('aria-selected'), 'true');
      await page.keyboard.press('ArrowLeft');
      assert.equal(await tabs.first().getAttribute('aria-selected'), 'true');
      await page.screenshot({ path: `output/site-arabic/inquiry-${division}-${language}-${width}.png` });
      await page.keyboard.press('Escape');
      if (division === 'electrical') {
        const form = page.locator('.pv-inquiry form');
        await form.locator('[name=name]').fill('Fail');
        await form.locator('[name=email]').fill('arabic@example.org');
        await form.locator('[name=country]').fill('الإمارات العربية المتحدة');
        assert.equal(await form.locator('[name=name]').evaluate(node => getComputedStyle(node).direction), 'ltr');
        assert.equal(await form.locator('[name=country]').evaluate(node => getComputedStyle(node).direction), 'rtl');
        assert.equal(await form.locator('[name=email]').evaluate(node => getComputedStyle(node).direction), 'ltr');
        await form.locator('[name=message]').fill('نحتاج إلى محول لمشروعنا الجديد.');
        await form.locator('[type=submit]').click();
        await page.waitForSelector('.pv-inquiry .form-status.error');
        assert.match(await page.locator('.pv-inquiry .form-status.error').innerText(), language === 'ar' ? /[\u0600-\u06ff]/ : /Veuillez/);
        assert.equal(await form.locator('[name=message]').inputValue(), 'نحتاج إلى محول لمشروعنا الجديد.');
        await form.locator('[name=name]').fill('Arabic visitor');
        await form.locator('[type=submit]').click();
        await page.getByRole('button', { name: language === 'ar' ? /متابعة التصفح/ : /Continuer la visite/ }).click();
        assert.equal(records.length, index * 2 + (language === 'ar' ? 1 : 2));
        assert.match(records.at(-1).source, /^catalogue:\/products\/electrical/);
        assert.ok(records.at(-1).productType);
      } else await page.locator('.pv-inquiry .close').click();
    }
    }
    const modelPath = new URL(page.url()).pathname;
    await page.locator('#language').click();
    await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
    await page.waitForURL(`${base}${modelPath}?lang=en`);
    await settled(page, 'en');
    await originalHeader(page);
    await originalOrder(page, '.pd-overview-copy', '.pd-gallery', width === 1440 ? 'x' : 'y');
    await page.locator('#language').click();
    await page.getByRole('menuitemradio', { name: 'Français', exact: true }).click();
    await page.waitForURL(`${base}${modelPath}?lang=fr`);
    await settled(page, 'fr');
    await page.goto(`${base}/`);
    await page.waitForURL('**/?lang=fr');
    await settled(page, 'fr');
    assert.deepEqual(await page.locator('.division-hero-copy h2').allTextContents(), ['Habitat modulaire', 'Équipements électriques']);
    await context.close();
    console.log(`English/Arabic/French desktop/mobile checks passed: ${width}px`);
  }
  const detailContext = await browser.newContext({ viewport: { width: 1440, height: 950 }, extraHTTPHeaders: { 'x-forwarded-for': '198.51.100.90' } });
  const detailPage = await detailContext.newPage();
  detailPage.on('pageerror', error => issues.push(error.message));
  const detailPath = '/products/electrical/distribution-transformers/scb10-10kv-250kva';
  await detailPage.goto(`${base}${detailPath}?lang=en`);
  await settled(detailPage, 'en');
  const inline = detailPage.locator('.pd-inline-inquiry form');
  assert.equal(await inline.locator('[name=productType]').inputValue(), 'scb10-10kv-250kva');
  await inline.locator('[name=name]').fill('Fail');
  await inline.locator('[name=email]').fill('details@example.org');
  await inline.locator('[name=country]').fill('United Arab Emirates');
  await inline.locator('[name=quantity]').fill('2');
  await inline.locator('[name=message]').fill('Please send the drawings and configuration for our project.');
  await inline.locator('[type=submit]').click();
  await inline.locator('.form-status.error').waitFor();
  assert.equal(await inline.locator('[name=quantity]').inputValue(), '2');
  assert.equal(await inline.locator('[name=message]').inputValue(), 'Please send the drawings and configuration for our project.');
  const savedBefore = records.length;
  await inline.locator('[name=name]').fill('Product page visitor');
  await inline.locator('[type=submit]').click();
  await detailPage.locator('.pd-inline-success').waitFor();
  assert.equal(records.length, savedBefore + 1);
  assert.equal(records.at(-1).source, `catalogue:${detailPath}`);
  assert.equal(records.at(-1).productType, 'scb10-10kv-250kva');
  await detailPage.getByRole('button', { name: /Send another inquiry/ }).click();
  assert.equal(await inline.locator('[name=productType]').inputValue(), 'scb10-10kv-250kva');
  assert.equal(await inline.locator('[name=name]').inputValue(), '');
  await detailContext.close();
  console.log('Product page inline inquiry: failure recovery, saved SKU/source and repeat inquiry passed');
  assert.deepEqual(issues, []);
  assert.ok(reads.includes('ar') && reads.includes('en') && reads.includes('fr'));
  console.log(JSON.stringify({ viewports: [1440, 390, 320], savedFixtureInquiries: records.length, screenshots: 'output/site-arabic', browserErrors: issues }));
} finally {
  await browser?.close();
  web.kill();
  cms.closeAllConnections();
  await new Promise(resolve => cms.close(resolve));
}
