// Run after build:web. Uses isolated CMS fixtures; never writes to a real CMS.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const slugs = ['energy-utilities', 'industrial-projects', 'residential-hospitality', 'commercial-temporary-buildings'];
const reads = [];
const cms = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://fixture.invalid');
  const locale = url.searchParams.get('locale');
  response.setHeader('content-type', 'application/json');
  if (url.pathname === '/uploads/application.svg') return response.writeHead(200, { 'content-type': 'image/svg+xml' }).end('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="400"><rect width="1000" height="400" fill="#e8d6d6"/></svg>');
  if (url.pathname === '/api/homepage') return response.end(JSON.stringify({ products: [], faqs: [], settings: null }));
  if (url.pathname === '/api/products') return response.end(JSON.stringify({ data: [], meta: { pagination: { page: 1, pageSize: 100, pageCount: 0, total: 0 } } }));
  const slug = url.pathname.replace('/api/application-', '');
  if (slugs.includes(slug)) {
    reads.push({ slug, locale });
    const unpublished = slug === 'industrial-projects' && locale === 'fr';
    return response.end(JSON.stringify({ data: unpublished ? null : {
      title: `${slug} (${locale})`, summary: `Published summary: ${slug}`, locale, publishedAt: '2026-11-02T00:00:00Z',
      body: `## ${locale === 'ar' ? 'حلول التطبيقات' : 'Application solutions'}\n\n**Independent content: ${slug}**\n\n- Design\n- Delivery\n\n[Contact](/contact?lang=${locale})\n\n![Project](/uploads/application.svg)`,
      coverImage: { url: '/uploads/application.svg', alternativeText: 'Application cover' }
    } }));
  }
  response.writeHead(404).end('{}');
});
await new Promise(resolve => cms.listen(0, '127.0.0.1', resolve));
const port = Number(process.env.APPLICATION_BROWSER_PORT || 3113), origin = `http://127.0.0.1:${port}`;
const web = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(port)], {
  cwd: path.resolve('apps/web'), windowsHide: true,
  env: { ...process.env, NODE_ENV: 'production', SITE_PREVIEW_MODE: '', STRAPI_PUBLIC_URL: `http://127.0.0.1:${cms.address().port}`, STRAPI_SERVER_TOKEN: 'isolated-test-token', TURNSTILE_SITE_KEY: '', NEXT_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let log = '', browser;
web.stdout.on('data', chunk => { log += chunk; });
web.stderr.on('data', chunk => { log += chunk; });
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (web.exitCode !== null) throw new Error(log);
    try { ready = (await fetch(`${origin}/api/health`)).ok; } catch {}
    if (ready) break;
    await delay(200);
  }
  assert.ok(ready, log);
  for (const slug of slugs) for (const locale of ['en', 'fr', 'ar']) {
    const response = await fetch(`${origin}/applications/${slug}?lang=${locale}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    if (slug === 'industrial-projects' && locale === 'fr') assert.ok(html.includes('hp-application-intro'), 'Unpublished page keeps its existing introduction');
    else {
      assert.ok(html.includes(`<title>${slug} (${locale}) | ZHUDUO</title>`));
      assert.ok(html.includes(`<strong>Independent content: ${slug}</strong>`));
      assert.ok(html.includes(`lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}"`));
      assert.ok(html.includes(`src="http://127.0.0.1:${cms.address().port}/uploads/application.svg"`));
    }
  }
  assert.equal(reads.length, 12, 'Shared route/metadata resolver reads each application only once');
  console.log('Production HTTP checks passed: all four applications, three languages, metadata, CMS images and unpublished fallback.');
  if (process.env.APPLICATION_HTTP_ONLY === 'true') process.exitCode = 0;
  else {
    const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON || import.meta.url);
    let chromium;
    try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('playwright-core')); }
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [1440, 390]) for (const locale of ['en', 'fr', 'ar']) {
      await page.setViewportSize({ width, height: 950 });
      await page.goto(`${origin}/applications/energy-utilities?lang=${locale}`, { waitUntil: 'networkidle' });
      await page.locator('.hp-markdown').waitFor();
      assert.equal(await page.locator('h1').textContent(), `energy-utilities (${locale})`);
      const state = await page.evaluate(() => ({ direction: document.documentElement.dir, overflow: document.documentElement.scrollWidth > innerWidth + 1, imagesReady: [...document.querySelectorAll('.hp-application-article img')].every(image => image.complete && image.naturalWidth > 0) }));
      assert.equal(state.direction, 'ltr');
      assert.equal(state.overflow, false, `${width}/${locale} overflow`);
      assert.equal(state.imagesReady, true);
      if (width === 1440 && locale === 'en') {
        const output = path.resolve('output/application-pages'); fs.mkdirSync(output, { recursive: true });
        await page.screenshot({ path: path.join(output, 'energy-utilities-desktop.png'), fullPage: true });
      }
    }
    assert.deepEqual(errors, []);
    console.log('Browser checks passed: desktop/mobile, English/French/Arabic, images and hydration.');
  }
} finally {
  await browser?.close();
  web.kill();
  cms.closeAllConnections();
  await new Promise(resolve => cms.close(resolve));
}
