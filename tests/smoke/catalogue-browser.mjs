// Run after build:web with a Playwright runtime. Uses an isolated HTTP CMS
// fixture; it never writes to a real CMS or database.
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
const brochure = JSON.parse(fs.readFileSync('packages/contracts/company-products.json', 'utf8'));
const records = [];
const reads = [];
const products = locale => [
  ...brochure.products.slice(0, 5).map(product => ({ ...product[locale], slug: product.slug, categoryKey: product.categoryKey, customizableOptions: product[locale].options, imageUrl: product.imageUrl })),
  ...(locale === 'en' ? Array.from({ length: 13 }, (_, index) => ({ slug: `cms-transformer-${index + 1}`, categoryKey: index % 2 ? 'power-transformers' : 'distribution-transformers', category: 'Custom CMS category', title: `Published transformer ${index + 1}`, summary: 'Approved CMS summary', detail: 'Approved CMS specification', customizableOptions: ['Approved configuration'], imageUrl: '' })) : [])
];
const cms = http.createServer(async (request, response) => {
  response.setHeader('content-type', 'application/json');
  const url = new URL(request.url, 'http://localhost');
  const locale = url.searchParams.get('locale') === 'zh-Hans' ? 'zh-Hans' : 'en';
  if (url.pathname === '/api/homepage') {
    return response.end(JSON.stringify({ products: products(locale).slice(0, 12), faqs: [], settings: { siteName: 'ZhuDuo', contactEmail: '', footerNote: '' } }));
  }
  if (url.pathname === '/api/products') {
    reads.push({ url: request.url, authorization: request.headers.authorization });
    return response.end(JSON.stringify({ data: products(locale), meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: products(locale).length } } }));
  }
  if (url.pathname === '/api/inquiries/submit') {
    assert.equal(request.headers.authorization, 'Bearer browser-catalogue-test-secret');
    let input = '';
    for await (const chunk of request) input += chunk;
    const data = JSON.parse(input);
    if (data.name === 'Fail') return response.writeHead(500).end('{}');
    if (data.name === 'Unconfirmed') return response.end('{}');
    records.push(data);
    return response.writeHead(201).end(JSON.stringify({ id: `test-${records.length}`, status: 'received' }));
  }
  response.writeHead(404).end('{}');
});
await new Promise(resolve => cms.listen(0, '127.0.0.1', resolve));
const port = Number(process.env.CATALOGUE_WEB_PORT || 3104);
const base = `http://127.0.0.1:${port}`;
const web = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(port)], {
  cwd: path.resolve('apps/web'),
  env: { ...process.env, NODE_ENV: 'production', SITE_PREVIEW_MODE: '', STRAPI_PUBLIC_URL: `http://127.0.0.1:${cms.address().port}`, STRAPI_SERVER_TOKEN: 'browser-catalogue-test-secret', TURNSTILE_SITE_KEY: '', TRUST_PROXY: 'true' },
  windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
});
let logs = '';
web.stdout.on('data', data => logs += data);
web.stderr.on('data', data => logs += data);
let browser;
fs.mkdirSync('output/implementation', { recursive: true });
try {
  for (let attempt = 0; ; attempt++) {
    assert.ok(attempt < 100 && web.exitCode === null, logs);
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch {}
    await delay(200);
  }
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {}) });
  for (const [index, width, height, mobile] of [[1, 1440, 1000, false], [2, 390, 844, true], [3, 844, 390, true], [4, 320, 780, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, extraHTTPHeaders: { 'x-forwarded-for': `198.51.100.${index}` } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/?lang=zh`);
    await page.locator('.hero h1').filter({ hasText: '多一点空间' }).waitFor();
    for (const id of ['home', 'homes', 'about', 'process', 'projects', 'faq']) assert.equal(await page.locator('#' + id).count(), 1);
    assert.equal(new URL(page.url()).pathname, '/');
    if (mobile) {
      await page.getByRole('button', { name: '打开导航菜单', exact: true }).click();
      await page.locator('.pv-product-trigger').click();
    } else await page.locator('.pv-product-trigger').hover();
    const group = page.locator('.pv-group-link').filter({ hasText: '模块化房屋' });
    assert.equal(await group.getAttribute('href'), '/products/modular-housing?lang=zh');
    await group.click();
    await page.waitForURL('**/products/modular-housing?lang=zh');
    await page.locator('.pv-product-card').first().waitFor();
    assert.equal(await page.locator('.pv-product-card').count(), 5);
    assert.equal(await page.getByText('设计预览', { exact: false }).count(), 0);
    const image = page.locator('button.pv-product-image').first();
    await image.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => scrollY);
    const url = page.url();
    await image.click();
    const popup = page.locator('.pv-info-dialog');
    await popup.waitFor({ state: 'visible' });
    assert.equal(page.url(), url);
    assert.ok(Math.abs(before - await page.evaluate(() => scrollY)) <= 1);
    const size = await popup.evaluate(dialog => ({ width: dialog.offsetWidth, height: dialog.offsetHeight, viewportWidth: innerWidth, viewportHeight: innerHeight }));
    assert.ok(size.width <= size.viewportWidth && size.height <= size.viewportHeight);
    await page.keyboard.press('Escape');
    await popup.waitFor({ state: 'hidden' });
    assert.ok(Math.abs(before - await page.evaluate(() => scrollY)) <= 1);
    if (width === 1440 || width === 390) await page.screenshot({ path: `output/implementation/housing-${width}.png`, fullPage: true });

    await page.goto(`${base}/products/electrical?lang=en`);
    assert.equal(await page.locator('.pv-product-card').count(), 13, 'Catalogue must load beyond the homepage limit');
    assert.equal(await page.locator('.pv-product-card h3').first().innerText(), 'Published transformer 1');
    await page.locator('.pv-card-info').first().click();
    await popup.waitFor({ state: 'visible' });
    assert.match(await popup.innerText(), /Approved CMS specification/);
    await popup.getByRole('button', { name: 'Inquire about this product', exact: true }).click();
    const inquiry = page.locator('.pv-inquiry');
    await inquiry.waitFor({ state: 'visible' });
    assert.equal(await page.locator('dialog[open]').count(), 1);
    assert.equal(await inquiry.locator('input[name="productType"]').inputValue(), 'cms-transformer-1');
    await inquiry.locator('.direction-trigger').press('ArrowDown');
    const picker = page.locator('.direction-panel');
    await picker.waitFor({ state: 'visible' });
    assert.equal(await picker.getByRole('tab', { name: 'Electrical Equipment', exact: true }).getAttribute('aria-selected'), 'true');
    const pickerBounds = await picker.boundingBox();
    assert.ok(pickerBounds.x >= 0 && pickerBounds.x + pickerBounds.width <= width && pickerBounds.y >= 0 && pickerBounds.y + pickerBounds.height <= height, 'Picker stays inside the viewport');
    await picker.locator('input[type=search]').fill('transformer 1');
    assert.equal(await picker.locator('.direction-option').count(), 5);
    await picker.locator('input[type=search]').fill('no-matching-product');
    await picker.getByText('No matching categories or models.', { exact: false }).waitFor();
    await picker.getByRole('tab', { name: 'Modular Housing', exact: true }).click();
    assert.equal(await picker.locator('.direction-option').count(), 13, 'Switching divisions resets the search');
    await picker.locator('input[type=search]').fill('D7');
    await picker.locator('input[type=search]').press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal(await inquiry.locator('input[name="productType"]').inputValue(), 'space-capsule-d7');
    await inquiry.locator('.direction-trigger').click();
    await picker.getByRole('tab', { name: 'Electrical Equipment', exact: true }).click();
    await picker.getByRole('button', { name: 'Published transformer 1', exact: true }).click();
    await inquiry.locator('.direction-trigger').click();
    await page.keyboard.press('Escape');
    assert.equal(await inquiry.isVisible(), true, 'Escape closes the picker before the inquiry');
    assert.equal(await inquiry.locator('.direction-trigger').evaluate(element => document.activeElement === element), true);
    assert.equal(await inquiry.locator('input[name="productType"]').inputValue(), 'cms-transformer-1');
    await inquiry.locator('input[name="name"]').fill('Fail');
    await inquiry.locator('input[name="email"]').fill('visitor@example.com');
    await inquiry.locator('input[name="country"]').fill('UK');
    await inquiry.locator('textarea[name="message"]').fill('Please send approved transformer details');
    if (width === 1440) {
      await inquiry.getByRole('button', { name: /Send project brief/ }).click();
      await inquiry.locator('.form-status.error').waitFor();
      assert.equal(await inquiry.locator('input[name="email"]').inputValue(), 'visitor@example.com');
      assert.equal(records.length, 0);
      await inquiry.locator('input[name="name"]').fill('Unconfirmed');
      await inquiry.getByRole('button', { name: /Send project brief/ }).click();
      await inquiry.getByText(/did not confirm saving/).waitFor();
      assert.equal(records.length, 0);
      await inquiry.locator('input[name="name"]').fill('Visitor');
      await inquiry.getByRole('button', { name: /Send project brief/ }).click();
      await inquiry.getByRole('heading', { name: 'Inquiry submitted successfully', exact: true }).waitFor();
      assert.equal(records.length, 1);
      assert.equal(records[0].productType, 'cms-transformer-1');
      assert.equal(records[0].source, 'catalogue:/products/electrical');
      await inquiry.getByRole('button', { name: 'Continue browsing', exact: false }).click();
    } else await inquiry.getByRole('button', { name: 'Close', exact: true }).click();

    await page.goto(`${base}/products/electrical?lang=zh`);
    assert.equal(await page.locator('.pv-product-card').count(), 0);
    await page.locator('.pv-catalogue-empty').waitFor();
    assert.equal(await page.getByText(/Published transformer/).count(), 0, 'Unpublished translations must not fall back to English products');
    await page.locator('.pv-sidebar-categories a').filter({ hasText: '主变压器' }).click();
    await page.waitForURL('**/products/electrical/power-transformers?lang=zh');
    await page.locator('.pv-category-banner h1').filter({ hasText: '主变压器' }).waitFor();
    assert.equal(await page.locator('.pv-product-card').count(), 0);
    await page.locator('.pv-catalogue-empty').getByRole('button', { name: /咨询选型/ }).click();
    await inquiry.waitFor({ state: 'visible' });
    assert.equal(await inquiry.locator('input[name="productType"]').inputValue(), 'power-transformers');
    await inquiry.locator('.direction-trigger').click();
    assert.equal(await picker.getByRole('button', { name: '主变压器', exact: true }).getAttribute('aria-pressed'), 'true');
    await picker.getByRole('button', { name: '清除选择', exact: true }).click();
    assert.equal(await inquiry.locator('input[name="productType"]').inputValue(), '');
    await inquiry.getByRole('button', { name: '关闭', exact: true }).click();
    await page.reload();
    await page.locator('.pv-category-banner h1').filter({ hasText: '主变压器' }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const body = await page.content();
    assert.ok(!body.includes('browser-catalogue-test-secret'));
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS: ${width}×${height}, original homepage, formal menus, CMS classification, dialogs, inquiries and locale isolation`);
  }
  const page = await browser.newPage();
  await page.goto(`${base}/products/electrical/space-capsules?lang=en`);
  await page.getByRole('heading', { name: '404', exact: true }).waitFor();
  assert.ok(reads.length >= 2);
  assert.ok(reads.every(read => read.authorization === undefined));
  console.log('PASS: invalid category 404, public reads without server credentials, confirmed inquiry receipts only');
} finally {
  await browser?.close();
  web.kill();
  cms.closeAllConnections();
  await new Promise(resolve => cms.close(resolve));
}
