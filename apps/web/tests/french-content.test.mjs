import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { load, withEnvironment } from './compiled-web.mjs';

const require = createRequire(import.meta.url);
const catalogue = require('@modular/contracts/company-products.json');
const french = require('@modular/contracts/company-products.fr.json');
const taxonomy = require('@modular/contracts/product-taxonomy.json');

test('French product translations retain all models, numeric specifications and options', () => {
  assert.equal(Object.keys(french).length, catalogue.products.length);
  for (const product of catalogue.products) {
    const translated = french[product.slug];
    for (const field of ['title', 'category', 'summary', 'detail']) {
      assert.ok(translated[field]?.trim(), `${product.slug}:${field}`);
      assert.doesNotMatch(translated[field], /[\u0600-\u06ff\u3400-\u9fff]/);
      assert.notEqual(translated[field], product.en[field]);
    }
    const englishNumbers = product.en.detail.match(/\d+(?:[.,]\d+)?/g)?.map(number => number.replaceAll(',', ''));
    const frenchNumbers = translated.detail.match(/\d+(?:[\u202f\u00a0]\d{3})*(?:,\d+)?/g)?.map(number => number.replace(/[\u202f\u00a0]/g, '').replace(',', '.'));
    assert.deepEqual(frenchNumbers, englishNumbers, product.slug);
    assert.equal(translated.options.length, product.en.options.length);
    for (const model of product.en.title.match(/(?:SC\(B\)\d+|AC\d+|AE\d+|D7|ZGS11|YB|\d+FT|MINI)/g) || []) assert.ok(translated.title.includes(model), `${product.slug}:${model}`);
  }
  for (const division of taxonomy.divisions) for (const item of [division, ...division.categories]) assert.ok(item.name.fr);
});

test('French covers shared messages and all homepage copy without changing Arabic messages', () => {
  const messages = require('../lib/site-messages.fr.json');
  const arabic = require('../lib/site-messages.ar.json');
  for (const key of Object.keys(arabic)) assert.ok(messages[key], `Missing French message: ${key}`);
  const ts = require('typescript');
  const source = ts.createSourceFile('home-copy.ts', readFileSync(new URL('../components/home-copy.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
  const statement = source.statements.find(statement => ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => declaration.name.text === 'copy'));
  const copy = statement.declarationList.declarations[0].initializer.expression;
  const english = copy.properties.find(property => property.name.text === 'en').initializer;
  const home = require('../components/home-copy.fr.json');
  assert.deepEqual(Object.keys(home).sort(), english.properties.map(property => property.name.text).sort());
  assert.equal(load('lib/site-language.js').translate('fr', 'View information about {title}', { title: '$& D7' }), 'Voir les informations sur $& D7');
});

test('French loads its own CMS locale and never falls back to English or preview data in production', async () => {
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
      assert.deepEqual((await load('lib/content.js').loadSiteHomepage('fr')).products, []);
      assert.ok(requests.length >= 2);
      for (const request of requests.filter(url => !url.startsWith('/api/product-categories'))) assert.equal(new URL(request, 'http://fixture').searchParams.get('locale'), 'fr');
    });
    await withEnvironment({ NODE_ENV: 'production', SITE_PREVIEW_MODE: 'true', STRAPI_PUBLIC_URL: undefined }, async () => {
      const content = await load('lib/content.js').loadSiteHomepage('fr');
      assert.equal(content.products.length, 113);
      assert.equal(content.faqs[0][0], 'Que peut-on personnaliser ?');
      assert.equal(content.products[0].title, 'Maison conteneur extensible 20FT');
    });
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
