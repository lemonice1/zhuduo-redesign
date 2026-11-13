// Run after build:web. Exercises the real frontend against an isolated public
// catalogue fixture. Never submits inquiries or writes to the VM.
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
const cms = http.createServer((req, res) => {
  const locale = new URL(req.url, 'http://localhost').searchParams.get('locale') === 'zh-Hans' ? 'zh-Hans' : 'en';
  res.setHeader('Content-Type', 'application/json');
  if (!req.url.startsWith('/api/homepage')) return res.writeHead(404).end('{}');
  res.end(JSON.stringify({ products: catalogue.products.map(product => ({ ...product[locale], slug: product.slug, imageUrl: product.imageUrl })), faqs: [], settings: { siteName: 'ZhuDuo', contactEmail: '', footerNote: '' } }));
});
await new Promise(resolve => cms.listen(0, '127.0.0.1', resolve));
const port = Number(process.env.BROCHURE_WEB_PORT || 3103);
const web = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(port)], {
  cwd: path.resolve('apps/web'), env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', STRAPI_PUBLIC_URL: `http://127.0.0.1:${cms.address().port}`, STRAPI_SERVER_TOKEN: '', TURNSTILE_SITE_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe']
});
let logs = ''; web.stdout.on('data', data => logs += data); web.stderr.on('data', data => logs += data);
const base = `http://127.0.0.1:${port}`;
const output = path.resolve('.cache/brochure-browser'); fs.mkdirSync(output, { recursive: true });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (web.exitCode !== null) throw new Error(logs);
    try { ready = (await fetch(`${base}/api/health`)).ok; } catch {}
    if (ready) break; await delay(250);
  }
  assert.ok(ready, logs);
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {}) });
  for (const width of [1440, 390, 320]) for (const [language, locale] of [['en', 'en'], ['zh', 'zh-Hans']]) {
    const page = await browser.newPage({ viewport: { width, height: 960 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/?lang=${language}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: language === 'en' ? 'View all products' : '查看全部产品', exact: false }).click();
    assert.equal(await page.locator('.product').count(), 5);
    await page.evaluate(async () => {
      for (const image of document.images) image.loading = 'eager';
      await document.fonts.ready;
    });
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
    for (const [index, product] of catalogue.products.entries()) {
      const card = page.locator('.product').nth(index);
      assert.equal(await card.locator('h3').innerText(), product[locale].title);
      assert.equal(await card.locator('img').getAttribute('src'), product.imageUrl);
      assert.equal(await card.locator('.image-reference').count(), 0);
      assert.equal(await card.locator('img').evaluate(image => getComputedStyle(image).objectFit), 'contain');
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width} ${language} overflows`);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, `${language}-${width}.png`), fullPage: true });
    const filters = page.locator('.filters');
    await filters.getByRole('button', { name: language === 'en' ? 'Expandable Container Houses' : '扩展式集装箱房', exact: true }).click();
    assert.equal(await page.locator('.product').count(), 4);
    await filters.getByRole('button', { name: language === 'en' ? 'Space Capsules' : '太空舱', exact: true }).click();
    assert.equal(await page.locator('.product').count(), 1);
    await page.locator('.product').filter({ has: page.getByRole('heading', { name: language === 'en' ? 'D7 Space Capsule' : 'D7 太空舱', exact: true }) }).locator('h3 button').click();
    const dialog = page.getByRole('dialog');
    assert.match(await dialog.innerText(), /11500 × 3300 × 3300/);
    await dialog.getByRole('button', { name: language === 'en' ? 'Ask about this space' : '咨询这款产品', exact: false }).click();
    assert.equal(await dialog.locator('input[name="productType"]').inputValue(), 'space-capsule-d7');
    await dialog.locator('.direction-trigger').click();
    const picker = page.locator('.direction-panel');
    assert.equal(await picker.getByRole('tab', { name: language === 'en' ? 'Modular Housing' : '模块化房屋', exact: true }).getAttribute('aria-selected'), 'true');
    assert.equal(await picker.locator('.direction-option').count(), 12);
    await picker.locator('input[type=search]').fill('D7');
    assert.equal(await picker.locator('.direction-option').count(), 1);
    await page.keyboard.press('Escape');
    await picker.waitFor({ state: 'detached' });
    assert.equal(await dialog.isVisible(), true);
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`Brochure catalogue: ${language}, ${width}px — 5 matching images, filters, specifications and inquiry selection passed.`);
  }
} finally {
  await browser?.close(); web.kill(); cms.closeAllConnections(); await new Promise(resolve => cms.close(resolve));
}
