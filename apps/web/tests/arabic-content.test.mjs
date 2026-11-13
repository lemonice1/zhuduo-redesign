import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { load, withEnvironment } from './compiled-web.mjs';

const require = createRequire(import.meta.url);
const catalogue = require('@modular/contracts/company-products.json');
const translations = require('@modular/contracts/company-products.ar.json');
const taxonomy = require('@modular/contracts/product-taxonomy.json');

test('all current products have Arabic content with unchanged numerical specifications', () => {
  assert.equal(Object.keys(translations).length, catalogue.products.length);
  for (const product of catalogue.products) {
    const arabic = translations[product.slug];
    for (const field of ['title', 'category', 'summary', 'detail']) {
      assert.match(arabic[field], /[\u0600-\u06ff]/, `${product.slug}:${field}`);
      assert.doesNotMatch(arabic[field], /[\u3400-\u9fff]/);
    }
    assert.deepEqual(arabic.detail.match(/\d+(?:[.,]\d+)?/g), product.en.detail.match(/\d+(?:[.,]\d+)?/g), product.slug);
    assert.equal(arabic.options.length, product.en.options.length);
    const identifiers = new Set(['kV', 'kVA', 'SC', 'B', 'mm', 'AC', 'kW', 'FT', 'PVC', 'SPC', 'YB', 'ZGS', 'kg', 'AE', 'Z', 'Y', 'D', 'MINI', 'm']);
    for (const text of Object.values(arabic).flat()) for (const token of text.match(/[A-Za-z]+/g) || []) {
      assert.ok(identifiers.has(token), `Untranslated content in ${product.slug}: ${token}`);
    }
  }
  for (const division of taxonomy.divisions) for (const item of [division, ...division.categories]) assert.match(item.name.ar, /[\u0600-\u06ff]/);
});

test('public site language supports English, Arabic and French and retires old Chinese preferences', () => {
  const { siteLanguage } = load('lib/content.js');
  assert.equal(siteLanguage('ar'), 'ar');
  assert.equal(siteLanguage('fr'), 'fr');
  for (const value of [undefined, 'en', 'zh', 'zh-Hans', 'all', 'de']) assert.equal(siteLanguage(value), 'en');
});

test('Arabic content reads the Arabic CMS locale and does not substitute English when empty', async () => {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    if (req.url.startsWith('/api/product-categories')) return res.writeHead(404).end();
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(req.url.startsWith('/api/products') ? { data: [], meta: { pagination: { page: 1, pageSize: 100, pageCount: 0 } } } : { products: [], faqs: [], settings: null }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await withEnvironment({ NODE_ENV: 'production', SITE_PREVIEW_MODE: undefined, STRAPI_PUBLIC_URL: `http://127.0.0.1:${server.address().port}` }, async () => {
      const content = load('lib/content.js');
      const result = await content.loadSiteHomepage('ar');
      assert.deepEqual(result.products, []);
      assert.ok(requests.length >= 2);
      for (const request of requests.filter(url => !url.startsWith('/api/product-categories'))) assert.equal(new URL(request, 'http://local').searchParams.get('locale'), 'ar');
    });
    await withEnvironment({ NODE_ENV: 'production', SITE_PREVIEW_MODE: 'true', STRAPI_PUBLIC_URL: undefined }, async () => {
      const content = await load('lib/content.js').loadSiteHomepage('ar');
      assert.equal(content.products.length, 113);
      assert.equal(content.faqs.length, 4);
      assert.doesNotMatch(JSON.stringify(content), /[\u3400-\u9fff]/);
    });
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
