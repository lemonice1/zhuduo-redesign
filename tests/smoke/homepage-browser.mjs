// Run after npm run build:web. Uses an installed Playwright package, or
// PLAYWRIGHT_PACKAGE_JSON pointing to the package.json of a runtime with Playwright.
// The CMS and verification widget are isolated test doubles; no VM data is written.
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
const demo = JSON.parse(fs.readFileSync('packages/contracts/demo-content.json', 'utf8'));
const fixture = { ...demo, products: Array.from({ length: 6 }, (_, i) => ({ ...demo.products[i % 3], slug: `space-${i}`, category: i % 2 ? 'Workspaces' : 'Living spaces', title: `Published space ${i + 1}`, imageUrl: i === 0 ? '/missing-image.jpg' : '' })) };
const records = [], contentRequests = [];
const cms = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url.startsWith('/api/homepage')) {
    contentRequests.push(req.url);
    // Verify that missing translations show an honest empty state.
    res.end(JSON.stringify(req.url.includes('zh-Hans') ? { products: [], faqs: [], settings: null } : fixture));
  } else if (req.url.startsWith('/api/products?')) {
    const data = req.url.includes('zh-Hans') ? [] : fixture.products.map(p => ({ ...p, customizableOptions: p.options }));
    res.end(JSON.stringify({ data, meta: { pagination: { page: 1, pageSize: 100, pageCount: data.length ? 1 : 0, total: data.length } } }));
  } else if (req.url === '/api/inquiries/submit') {
    assert.equal(req.headers.authorization, 'Bearer browser-only-token');
    let raw = ''; for await (const chunk of req) raw += chunk;
    records.push(JSON.parse(raw));
    res.writeHead(201).end(JSON.stringify({ id: 'browser-test-receipt', status: 'received' }));
  } else res.writeHead(404).end('{}');
});
await new Promise(resolve => cms.listen(0, '127.0.0.1', resolve));
const port = Number(process.env.BROWSER_WEB_PORT || 3102);
const web = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(port)], {
  cwd: path.resolve('apps/web'), env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', TRUST_PROXY: 'true', STRAPI_PUBLIC_URL: `http://127.0.0.1:${cms.address().port}`, STRAPI_SERVER_TOKEN: 'browser-only-token', TURNSTILE_SITE_KEY: 'browser-test-site-key' }, stdio: ['ignore', 'pipe', 'pipe']
});
let log = ''; web.stdout.on('data', c => log += c); web.stderr.on('data', c => log += c);
const base = `http://127.0.0.1:${port}`;
const output = path.resolve('.cache/homepage-browser'); fs.mkdirSync(output, { recursive: true });
let browser;
const results = [];
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (web.exitCode !== null) throw new Error(log);
    try { ready = (await fetch(`${base}/api/health`)).ok; } catch {}
    if (ready) break; await delay(250);
  }
  assert.ok(ready, log);
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {}) });
  for (const [name, width, height] of [['desktop', 1440, 1000], ['tablet', 768, 1024], ['mobile', 390, 844], ['small', 320, 800]]) {
    // Each viewport represents a separate visitor, with two valid inquiries below the limit.
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: width <= 850, extraHTTPHeaders: { 'X-Forwarded-For': `192.0.2.${results.length + 1}` } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    // Exercise the UI's configured challenge lifecycle without external requests.
    await page.addInitScript(() => {
      window.turnstileOptions = null;
      window.turnstile = {
        render(_container, options) { window.turnstileOptions = options; return 'test-widget'; },
        reset() {}, remove() { window.turnstileOptions = null; }
      };
    });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => { for (const image of document.images) image.loading = 'eager'; });
    await page.locator('footer').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0)).catch(async error => { console.log(await page.evaluate(() => [...document.images].map(i => ({ src: i.src, complete: i.complete, width: i.naturalWidth })))); throw error; });
    await page.evaluate(() => scrollTo(0, 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ' overflow');
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
    assert.equal(await page.locator('.product').count(), 3);
    assert.equal(await page.locator('.product .image-reference').count(), 3);
    // Navigation dropdowns support the reference's hover interaction and touch/keyboard input.
    if (width <= 850) await page.locator('#menu').click();
    const homesNavigation = page.getByRole('button', { name: 'Products', exact: true, includeHidden: true });
    assert.equal(await homesNavigation.count(), 1, 'Product navigation has a dropdown trigger');
    const homesPanel = page.locator('#pv-product-menu');
    if (width > 850) {
      await page.locator('#language').focus();
      await homesNavigation.hover();
      await homesPanel.waitFor({ state: 'visible' });
      assert.equal(await page.locator('#language').evaluate(el => document.activeElement === el), true, 'Hover does not steal focus');
      await homesPanel.getByRole('link', { name: 'Electrical Equipment', exact: true }).hover();
      assert.equal(await homesNavigation.getAttribute('aria-expanded'), 'true', 'Moving into the panel keeps it open');
      await page.screenshot({ path: path.join(output, `${name}-product-menu.png`) });
      await page.getByRole('button', { name: 'Resources', exact: true }).hover();
      await homesPanel.waitFor({ state: 'hidden' });
      await page.locator('#resource-panel').waitFor({ state: 'visible' });
      await page.mouse.move(width - 1, height - 1);
      await page.locator('#resource-panel').waitFor({ state: 'hidden' });
      await homesNavigation.hover();
    } else await homesNavigation.tap();
    await homesNavigation.press('Escape');
    assert.equal(await homesNavigation.getAttribute('aria-expanded'), 'false');
    if (width <= 850) assert.equal(await page.locator('#menu').getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('.product').count(), 3);
    assert.match(await page.locator('.product').first().innerText(), /Published space 1/);
    await homesNavigation.focus();
    await homesNavigation.press('ArrowDown');
    await homesPanel.getByRole('link', { name: 'Electrical Equipment', exact: true }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.activeElement === document.querySelector('.pv-group-link'));
    assert.equal(await homesPanel.getByRole('link', { name: 'Electrical Equipment', exact: true }).evaluate(el => document.activeElement === el), true);
    await page.keyboard.press('End');
    assert.equal(await homesPanel.getByRole('button', { name: 'Expand Modular Housing', exact: true }).evaluate(el => document.activeElement === el), true);
    await page.keyboard.press('Escape');
    assert.equal(await homesNavigation.getAttribute('aria-expanded'), 'false');
    assert.equal(await homesNavigation.evaluate(el => document.activeElement === el), true);
    await homesNavigation.press('Enter');
    await homesPanel.waitFor({ state: 'visible' });
    const homesBox = await homesPanel.boundingBox();
    assert.ok(homesBox.x >= 0 && homesBox.x + homesBox.width <= width, name + ' product dropdown fits');
    await page.screenshot({ path: path.join(output, `${name}-product-menu-keyboard.png`) });
    await page.keyboard.press('Tab');
    assert.equal(await homesPanel.getByRole('link', { name: 'Electrical Equipment', exact: true }).evaluate(el => document.activeElement === el), true);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    assert.equal(await homesNavigation.getAttribute('aria-expanded'), 'false', 'Tab out closes the dropdown');
    if (width <= 850) await page.locator('#menu').click();
    await page.locator('.filters button').filter({ hasText: /^All spaces$/ }).click();
    await page.getByRole('button', { name: 'Workspaces', exact: true }).click();
    assert.equal(await page.locator('.product').count(), 3);
    assert.match(await page.locator('.product').first().innerText(), /Published space 2/);
    await page.locator('.filters button').filter({ hasText: /^All spaces$/ }).click();
    await page.getByRole('button', { name: 'View all products' }).click();
    assert.equal(await page.locator('.product').count(), 6);
    await page.getByRole('button', { name: 'Show featured products' }).click();
    const opener = page.locator('.card-photo').first();
    await opener.click(); await page.locator('dialog[open]').waitFor();
    assert.equal(await page.locator('#dialog-title').innerText(), 'Published space 1');
    await page.keyboard.press('Escape');
    assert.equal(await opener.evaluate(el => document.activeElement === el), true);
    await opener.click(); await page.getByRole('button', { name: 'Ask about this space' }).click();
    assert.equal(await page.locator('input[name=productType]').inputValue(), 'space-0');
    assert.equal(await page.locator('.close').evaluate(el => document.activeElement === el), true);
    const submit = page.locator('.inquiry-form button[type=submit]');
    assert.equal(await submit.isDisabled(), true);
    await page.evaluate(() => window.turnstileOptions.callback('browser-proof'));
    await page.waitForFunction(() => !document.querySelector('.inquiry-form button[type=submit]').disabled);
    await submit.click();
    assert.equal(await page.locator('input[name=name]').evaluate(el => el.validity.valueMissing), true);
    await page.locator('input[name=name]').fill('Browser test');
    await page.locator('input[name=email]').fill('browser@example.invalid');
    await page.locator('input[name=country]').fill('UK');
    await page.locator('textarea[name=message]').fill('Six modules, browser test only.');
    // API errors and malformed 200 responses must retain the draft and never report success.
    await page.route('**/api/inquiries', route => route.fulfill({ status: 502, json: { message: 'The inquiry service is temporarily unavailable.', errors: { productType: 'Please check your product choice.' } } }));
    await submit.click(); await page.locator('.form-status.error').waitFor();
    assert.equal(await page.locator('input[name=name]').inputValue(), 'Browser test');
    assert.equal(await page.locator('input[name=productType]').inputValue(), 'space-0');
    assert.equal(await page.locator('.direction-trigger').evaluate(element => document.activeElement === element), true, 'Product errors focus the visible picker');
    assert.equal(await submit.isDisabled(), true);
    await page.unroute('**/api/inquiries');
    await page.route('**/api/inquiries', route => route.fulfill({ status: 200, json: {} }));
    await page.evaluate(() => window.turnstileOptions.callback('browser-proof'));
    await submit.click();
    await page.getByRole('status').filter({ hasText: 'did not confirm saving' }).waitFor();
    assert.equal(await page.locator('textarea[name=message]').inputValue(), 'Six modules, browser test only.');
    await page.unroute('**/api/inquiries');
    await page.evaluate(() => window.turnstileOptions.callback('browser-proof'));
    await submit.click(); await page.locator('.success-copy').waitFor();
    assert.match(await page.locator('.success-copy').innerText(), /Inquiry submitted successfully/);
    assert.match(await page.locator('.success-copy').innerText(), /Thank you for your inquiry\. We will contact you soon\./);
    assert.doesNotMatch(await page.locator('.success-copy').innerText(), /browser-test-receipt|Reference/);
    assert.equal(await page.locator('.inquiry-form').count(), 0);
    assert.equal(records.at(-1).productType, 'space-0');
    assert.equal(records.at(-1).source, 'homepage:General');
    assert.equal(records.at(-1).turnstileToken, 'browser-proof');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.locator('dialog[open]').waitFor({ state: 'detached' });
    assert.equal(await opener.evaluate(el => document.activeElement === el), true);
    await page.getByRole('button', { name: 'Next image', exact: true }).click();
    assert.equal(await page.locator('#slide-count').innerText(), '02 / 03');
    await page.getByRole('button', { name: 'Previous image', exact: true }).click();
    await page.locator('summary').nth(1).click();
    assert.equal(await page.locator('details').nth(1).evaluate(el => el.open), true);
    const picker = page.getByRole('button', { name: 'Language', exact: true });
    await picker.click();
    const english = page.getByRole('menuitemradio', { name: 'English', exact: true });
    const chinese = page.getByRole('menuitemradio', { name: '简体中文', exact: true });
    assert.equal(await english.getAttribute('aria-checked'), 'true');
    assert.equal(await chinese.getAttribute('aria-checked'), 'false');
    const menuBox = await page.locator('.language-menu').boundingBox();
    assert.ok(menuBox.x >= 0 && menuBox.x + menuBox.width <= width, name + ' language menu fits');
    await page.screenshot({ path: path.join(output, `${name}-language-menu.png`) });
    await page.keyboard.press('Escape');
    assert.equal(await picker.getAttribute('aria-expanded'), 'false');
    assert.equal(await picker.evaluate(el => document.activeElement === el), true);
    await picker.press('ArrowDown');
    assert.equal(await english.evaluate(el => document.activeElement === el), true);
    await page.keyboard.press('ArrowDown');
    assert.equal(await chinese.evaluate(el => document.activeElement === el), true);
    await page.keyboard.press('Home');
    assert.equal(await english.evaluate(el => document.activeElement === el), true);
    await page.keyboard.press('End');
    assert.equal(await chinese.evaluate(el => document.activeElement === el), true);
    await page.keyboard.press('Tab');
    assert.equal(await picker.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('.nav-actions > .btn').evaluate(el => document.activeElement === el), true);
    await picker.click();
    await page.mouse.click(3, menuBox.y + menuBox.height + 10);
    assert.equal(await picker.getAttribute('aria-expanded'), 'false');
    await picker.click();
    await chinese.click();
    await page.waitForFunction(() => document.documentElement.lang === 'zh-CN');
    await page.getByText('此语言的产品尚未发布', { exact: false }).waitFor();
    assert.equal(await page.locator('.product').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ' Chinese overflow');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
    await page.getByRole('button', { name: '语言', exact: true }).click();
    assert.equal(await page.getByRole('menuitemradio', { name: '简体中文', exact: true }).getAttribute('aria-checked'), 'true');
    await page.keyboard.press('Escape');
    if (width <= 850) {
      await page.locator('#menu').click(); await page.keyboard.press('Escape');
      assert.equal(await page.locator('#menu').getAttribute('aria-expanded'), 'false');
      await page.locator('#menu').click(); await page.getByRole('button', { name: '产品中心', exact: true }).click();
      assert.equal(await page.locator('.pv-group-link').count(), 2, 'The approved business taxonomy remains available before translated products are published');
      await page.locator('#menu').click();
      assert.equal(await page.locator('#menu').getAttribute('aria-expanded'), 'false');
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, `${name}-zh.png`), fullPage: true });
    // An unpublished translation must still allow a customer to choose an inquiry direction.
    await page.locator('.floating').click();
    await page.locator('.direction-trigger').click();
    await page.locator('.direction-panel').getByRole('tab', { name: '模块化房屋', exact: true }).click();
    assert.equal(await page.locator('.direction-option').count(), 8, name + ' category choices remain without translated models');
    await page.locator('.direction-panel').getByRole('button', { name: '扩展式集装箱房', exact: true }).click();
    await page.locator('input[name=name]').fill('中文询盘测试');
    await page.locator('input[name=email]').fill('chinese-browser@example.invalid');
    await page.locator('input[name=country]').fill('中国');
    await page.locator('textarea[name=message]').fill('选择折叠房屋方向，测试提交。');
    await page.waitForFunction(() => Boolean(window.turnstileOptions));
    await page.evaluate(() => window.turnstileOptions.callback('browser-proof'));
    const submission = page.waitForResponse(response => response.url().endsWith('/api/inquiries') && response.request().method() === 'POST');
    await page.getByRole('button', { name: '提交项目需求 ↗', exact: true }).click();
    const response = await submission;
    assert.equal(response.status(), 201, await response.text());
    await page.locator('.success-copy').waitFor();
    assert.equal(records.at(-1).productType, 'expandable-homes');
    assert.match(await page.locator('.success-copy').innerText(), /感谢您的咨询，我们会尽快与您联系。/);
    await page.getByRole('button', { name: '完成', exact: true }).click();
    await page.locator('dialog[open]').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: '语言', exact: true }).press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    assert.equal(await page.locator('#language').innerText(), 'EN');
    assert.deepEqual(errors, []);
    assert.ok(!(await page.content()).includes('browser-only-token'));
    results.push({ name, width, status: 'PASS', checks: ['navigation hover/touch + keyboard + category filtering', 'CMS products, filters', 'fallback image labels', 'modal focus + Escape', 'challenge lifecycle', 'failure/malformed receipt retains draft', 'real Next proxy to CMS test double', 'carousel + FAQ', 'Chinese empty state + language persistence', 'inquiry direction without translated products', 'no horizontal overflow'] });
    await page.close();
  }
  assert.ok(contentRequests.includes('/api/homepage?locale=zh-Hans'));
  assert.equal(records.length, 8);
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} catch (error) {
  const page = browser?.contexts().at(-1)?.pages().at(-1);
  if (page) {
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
    fs.writeFileSync(path.join(output, 'failure.html'), await page.content());
  }
  throw error;
} finally {
  await browser?.close(); web.kill(); cms.closeAllConnections(); await new Promise(resolve => cms.close(resolve));
}
