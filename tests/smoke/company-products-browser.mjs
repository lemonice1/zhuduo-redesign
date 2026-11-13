// Real company catalogue through an isolated, paginated CMS fixture.
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
const pages = new Set();
const cms = http.createServer((request, response) => {
  response.setHeader('content-type', 'application/json');
  const url = new URL(request.url, 'http://localhost');
  const locale = url.searchParams.get('locale') === 'zh-Hans' ? 'zh-Hans' : 'en';
  const products = catalogue.products.map((product, index) => ({
    ...product[locale], documentId: `company-${index}`, slug: product.slug, categoryKey: product.categoryKey,
    customizableOptions: product[locale].options, imageUrl: '', image: { url: product.imageUrl },
    gallery: product.galleryUrls.map(url => ({ url })),
    brochure: product.brochureKey ? { url: `http://127.0.0.1:${cms.address().port}/brochure.pdf` } : null
  }));
  if (url.pathname === '/api/homepage') return response.end(JSON.stringify({ products: [], faqs: [], settings: { siteName: 'ZhuDuo' } }));
  if (url.pathname === '/api/products') {
    const page = Number(url.searchParams.get('pagination[page]')); pages.add(page);
    return response.end(JSON.stringify({ data: products.slice((page - 1) * 100, page * 100), meta: { pagination: { page, pageSize: 100, pageCount: Math.ceil(products.length / 100), total: products.length } } }));
  }
  response.writeHead(404).end('{}');
});
await new Promise(resolve => cms.listen(0, '127.0.0.1', resolve));
const port = Number(process.env.COMPANY_WEB_PORT || 3113), base = `http://127.0.0.1:${port}`;
const web = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(port)], {
  cwd: path.resolve('apps/web'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'production', SITE_PREVIEW_MODE: '', STRAPI_PUBLIC_URL: `http://127.0.0.1:${cms.address().port}` }
});
let logs = '', browser;
web.stdout.on('data', data => logs += data); web.stderr.on('data', data => logs += data);
fs.mkdirSync('output/implementation', { recursive: true });
try {
  for (let attempt = 0; ; attempt++) {
    assert.ok(attempt < 100 && web.exitCode === null, logs);
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch {}
    await delay(200);
  }
  browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/products/modular-housing?lang=en`);
    await page.locator('.pv-product-card').first().waitFor();
    assert.equal(await page.locator('.pv-product-card').count(), 17);
    await page.locator('[data-product-slug="apple-cabin-ac01"] .pv-card-info').click();
    await page.waitForURL(`${base}/products/modular-housing/apple-cabins/apple-cabin-ac01?lang=en`);
    const detail = page.locator('.product-detail-page'); await detail.waitFor({ state: 'visible' });
    assert.equal(await detail.locator('.product-gallery-thumbnails button').count(), 3);
    const cover = await detail.locator('.product-gallery-main img').getAttribute('src');
    await detail.getByRole('button', { name: 'View image 2', exact: true }).click();
    assert.notEqual(await detail.locator('.product-gallery-main img').getAttribute('src'), cover);
    assert.equal(await detail.getByRole('link', { name: /View product brochure/ }).getAttribute('target'), '_blank');
    assert.equal(await detail.locator('.pd-inline-inquiry input[name=productType]').inputValue(), 'apple-cabin-ac01');
    assert.equal(await page.locator('.pv-info-dialog').count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `output/implementation/company-gallery-${width}.png` });
    await page.reload();
    assert.equal(await page.locator('.pd-title h1').innerText(), 'AC01 Apple Cabin');
    await page.goBack();
    await page.locator('.pv-catalogue-search input').waitFor();
    await page.locator('.pv-catalogue-search input').fill('AC06');
    assert.equal(await page.locator('.pv-product-card').count(), 1);
    assert.equal(await page.locator('.pv-product-card').getAttribute('data-product-slug'), 'apple-cabin-ac06');
    await page.goto(`${base}/products/electrical?lang=en`);
    await page.locator('.pv-product-card').first().waitFor();
    assert.equal(await page.locator('.pv-product-card').count(), 24);
    assert.match(await page.locator('.pv-pagination').innerText(), /1 \/ 4 · 96/);
    const seen = new Set(await page.locator('.pv-product-card').evaluateAll(cards => cards.map(card => card.dataset.productSlug)));
    for (let index = 2; index <= 4; index++) {
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      assert.match(await page.locator('.pv-pagination').innerText(), new RegExp(`${index} / 4`));
      for (const slug of await page.locator('.pv-product-card').evaluateAll(cards => cards.map(card => card.dataset.productSlug))) { assert.ok(!seen.has(slug)); seen.add(slug); }
    }
    assert.equal(seen.size, 96);
    await page.locator('.pv-catalogue-search input').fill('31500');
    assert.equal(await page.locator('.pv-product-card').count(), 2);
    await page.screenshot({ path: `output/implementation/company-electrical-${width}.png`, fullPage: true });
    const broken = await page.locator('.pv-product-image img').evaluateAll(images => images.filter(image => image.complete && image.naturalWidth === 0).map(image => image.src));
    assert.deepEqual(broken, []); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []); await page.close();
    console.log(`PASS: ${width}px, 113 published products, detail routes, refresh/back, CMS pagination, gallery, PDF link and search`);
  }
  assert.deepEqual([...pages].sort(), [1, 2]);
} finally { await browser?.close(); web.kill(); cms.closeAllConnections(); await new Promise(resolve => cms.close(resolve)); }
