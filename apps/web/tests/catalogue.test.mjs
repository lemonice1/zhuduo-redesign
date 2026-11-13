import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { load, withEnvironment } from './compiled-web.mjs';

test('catalogue classification honors CMS keys and recognizes existing bilingual brochure products', () => {
  const { productCategory, catalogueProducts, divisions } = load('lib/catalogue.js');
  assert.equal(productCategory({ slug: 'expandable-20ft', category: 'Custom name' }), 'expandable-homes');
  assert.equal(productCategory({ slug: 'new-unit', category: '太空舱' }), 'space-capsules');
  assert.equal(productCategory({ slug: 'new-transformer', category: 'Custom name', categoryKey: 'power-transformers' }), 'power-transformers');
  assert.equal(productCategory({ slug: 'expandable-20ft', category: 'Expandable Container Houses', categoryKey: 'invalid' }), undefined);
  assert.equal(productCategory({ slug: 'custom', category: 'Not classified' }), undefined);
  const base = { title: 'Product', summary: 'Summary', detail: 'Details', options: [], imageUrl: '' };
  const products = [{ ...base, slug: 'electrical', category: '', categoryKey: 'power-transformers' }, { ...base, slug: 'space-capsule-d7', category: '' }];
  assert.deepEqual(catalogueProducts(products, divisions[0]).map(product => product.slug), ['electrical']);
  assert.deepEqual(catalogueProducts(products, divisions[1]).map(product => product.slug), ['space-capsule-d7']);
});

test('catalogue reads every published CMS page for the requested locale and normalizes uploaded media', async () => {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push({ url: request.url, authorization: request.headers.authorization });
    const page = Number(new URL(request.url, 'http://localhost').searchParams.get('pagination[page]'));
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ data: [{ slug: `transformer-${page}`, title: `Transformer ${page}`, category: 'Transformer', categoryKey: 'distribution-transformers', summary: 'Published', customizableOptions: ['Layout', 'Layout', 42], image: page === 1 ? { url: '/uploads/transformer.jpg' } : null, imageUrl: page === 2 ? '/products/expandable-20ft.webp' : '', createdBy: { email: 'private@example.com' } }], meta: { pagination: { page, pageSize: 100, pageCount: 2, total: 2 } } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    await withEnvironment({ NODE_ENV: 'production', SITE_PREVIEW_MODE: undefined, STRAPI_PUBLIC_URL: origin, STRAPI_SERVER_TOKEN: 'private-secret' }, async () => {
      const products = await load('lib/content.js').loadCatalogue('zh-Hans');
      assert.deepEqual(products.map(product => product.slug), ['transformer-1', 'transformer-2']);
      assert.equal(products[0].categoryKey, 'distribution-transformers');
      assert.equal(products[0].imageUrl, `${origin}/uploads/transformer.jpg`);
      assert.equal(products[1].imageUrl, '/products/expandable-20ft.webp');
      assert.deepEqual(products[0].options, ['Layout']);
      assert.ok(!JSON.stringify(products).includes('private@example.com'));
      assert.equal(requests.length, 2);
      for (const request of requests) {
        const url = new URL(request.url, origin);
        assert.equal(url.pathname, '/api/products');
        assert.equal(url.searchParams.get('locale'), 'zh-Hans');
        assert.equal(request.authorization, undefined);
      }
    });
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('catalogue CMS failures and malformed pagination never substitute brochure data', async () => {
  let body = {};
  let status = 200;
  const server = http.createServer((request, response) => response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body)));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await withEnvironment({ NODE_ENV: 'production', SITE_PREVIEW_MODE: undefined, STRAPI_PUBLIC_URL: `http://127.0.0.1:${server.address().port}` }, async () => {
      const { loadCatalogue } = load('lib/content.js');
      for (const invalid of [{}, { data: [], meta: {} }, { data: [], meta: { pagination: { page: 1, pageSize: 100, pageCount: 1001 } } }, { data: [], meta: { pagination: { page: 0, pageSize: 100, pageCount: 1 } } }]) {
        body = invalid;
        await assert.rejects(loadCatalogue('en'));
      }
      status = 503;
      await assert.rejects(loadCatalogue('en'));
    });
    await withEnvironment({ NODE_ENV: 'production', SITE_PREVIEW_MODE: undefined, STRAPI_PUBLIC_URL: undefined }, async () => {
      const content = load('lib/content.js');
      await assert.rejects(content.loadCatalogue('en'));
      await assert.rejects(content.loadSiteHomepage('en'));
    });
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('empty translated catalogues stay empty while explicit local review uses brochure content', async () => {
  const server = http.createServer((request, response) => response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ data: [], meta: { pagination: { page: 1, pageSize: 100, pageCount: 0, total: 0 } } })));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await withEnvironment({ NODE_ENV: 'production', SITE_PREVIEW_MODE: undefined, STRAPI_PUBLIC_URL: `http://127.0.0.1:${server.address().port}` }, async () => assert.deepEqual(await load('lib/content.js').loadCatalogue('zh-Hans'), []));
    await withEnvironment({ NODE_ENV: 'production', SITE_PREVIEW_MODE: 'true', STRAPI_PUBLIC_URL: undefined }, async () => {
      const content = load('lib/content.js');
      assert.equal((await content.loadCatalogue('zh-Hans')).length, 113);
      assert.equal((await content.loadSiteHomepage('zh-Hans')).products[0].title, '20FT 扩展式集装箱房');
      await assert.rejects(content.loadHomepage('zh-Hans'));
    });
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
