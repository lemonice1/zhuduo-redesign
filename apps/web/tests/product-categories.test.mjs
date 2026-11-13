import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { load, withEnvironment } from './compiled-web.mjs';

const { defaultProductCategories: defaults, normalizeProductCategories } = load('lib/product-categories.js');
const { createSiteArchitecture, siteProductCategoryPath } = load('lib/site-architecture.js');
const product = (slug, categoryKey) => ({ slug, categoryKey, category: '', title: slug, summary: '', detail: '', options: [], imageUrl: '', tone: '', eyebrow: '' });
const custom = { key: 'garden-rooms', slug: 'garden-rooms', division: 'modular-buildings', group: 'none', nameEn: 'Garden Rooms', nameFr: 'Studios de jardin', nameAr: 'غرف الحديقة', nameZh: '花园房', sortOrder: -10, visible: true };

test('managed defaults preserve existing product routes and menu order, including historical electrical keys', () => {
  const managed = createSiteArchitecture(defaults);
  assert.deepEqual(managed.navigation.find(node => node.slug === 'electrical').children[0].children.map(node => node.slug), ['power-transformers', 'distribution-transformers', 'dry-type-transformers', 'special-transformers']);
  const rows = [product('expandable-20ft', 'expandable-homes'), product('scb10-10kv-250kva', 'distribution-transformers'), product('substation-yb', 'substations'), product('substation-prefabricated', 'substations'), product('lv-model', 'lv-distribution'), product('solar-house', 'solar-homes')];
  for (const row of rows) {
    assert.equal(managed.categoryPath(row), siteProductCategoryPath(row));
    assert.ok(managed.page(managed.categoryPath(row)));
  }
  assert.equal(managed.navigation.find(node => node.slug === 'modular-buildings').children.length, 7);
});

test('new names, languages and sorting feed navigation, category routes, products and inquiry choices together', () => {
  const records = normalizeProductCategories([...defaults, custom]);
  const architecture = createSiteArchitecture(records);
  const path = 'modular-buildings/garden-rooms';
  const row = product('garden-01', custom.key);
  assert.equal(architecture.navigation.find(node => node.slug === 'modular-buildings').children[0].name.fr, custom.nameFr);
  assert.equal(architecture.page(path).name.ar, custom.nameAr);
  assert.equal(architecture.productCategory(row), custom.key);
  assert.equal(architecture.productHref(row, 'fr'), '/products/modular-buildings/garden-rooms/garden-01?lang=fr');
  assert.deepEqual(architecture.products(path, [row]), [row]);
  assert.deepEqual(architecture.directions('fr').find(choice => choice.value === custom.key), { value: custom.key, title: custom.nameFr, division: 'modular-housing' });
  const { inquiryDirectionGroups } = load('lib/inquiry-directions.js');
  const housing = inquiryDirectionGroups([row], architecture.directions('fr'), 'fr').find(group => group.value === 'modular-housing');
  assert.ok(housing.categories.some(choice => choice.value === custom.key));
  assert.ok(housing.models.some(choice => choice.value === row.slug));
  const reassigned = { ...product('scb10-10kv-250kva', 'distribution-transformers'), categoryKey: custom.key };
  assert.equal(architecture.productCategory(reassigned), custom.key, 'explicit new assignments beat legacy slug matching');
});

test('hiding removes menu choices while preserving published pages; empty data never resurrects defaults', () => {
  const hidden = createSiteArchitecture([{ ...custom, visible: false }]);
  assert.equal(hidden.navigation.find(node => node.slug === 'modular-buildings').children.length, 0);
  assert.equal(hidden.directions('en').length, 0);
  assert.equal(hidden.page('modular-buildings/garden-rooms').name.en, custom.nameEn);
  assert.ok(hidden.productHref(product('garden-01', custom.key), 'en').includes('/garden-rooms/garden-01'));
  const empty = createSiteArchitecture([]);
  assert.equal(empty.page('modular-buildings/expandable-houses'), undefined);
  assert.equal(empty.products('modular-buildings', [product('expandable-20ft', 'expandable-homes')]).length, 0);
  assert.ok(createSiteArchitecture().page('modular-buildings/expandable-houses'), 'missing old-version API keeps compatibility');
});

test('category normalization rejects duplicate identity and invalid routes, with English fallback for empty translations', () => {
  for (const rows of [[custom, custom], [{ ...custom, division: 'unknown' }], [{ ...custom, slug: '../bad' }], [{ ...custom, group: 'transformers' }]]) assert.throws(() => normalizeProductCategories(rows));
  const architecture = createSiteArchitecture(normalizeProductCategories([{ ...custom, nameFr: '', nameAr: null }]));
  assert.equal(architecture.page('modular-buildings/garden-rooms').name.ar, custom.nameEn);
});

async function withCms(responder, work) {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push({ url: request.url, authorization: request.headers.authorization });
    const result = responder(new URL(request.url, 'http://localhost'));
    response.writeHead(result.status ?? 200, { 'content-type': 'application/json' }).end(JSON.stringify(result.body));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await withEnvironment({ NODE_ENV: 'production', STRAPI_PUBLIC_URL: `http://127.0.0.1:${server.address().port}`, STRAPI_SERVER_TOKEN: 'private-not-for-category-reads' }, () => work(load('lib/product-category-content.js').loadProductCategories, requests));
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('category loader follows published pagination without credentials and distinguishes missing, empty and failed APIs', async () => {
  await withCms(url => {
    const page = Number(url.searchParams.get('pagination[page]'));
    return { body: { data: page === 1 ? defaults : [custom], meta: { pagination: { page, pageSize: 100, pageCount: 2 } } } };
  }, async (read, requests) => {
    assert.equal((await read()).length, defaults.length + 1);
    assert.equal(requests.length, 2);
    assert.ok(requests.every(request => request.authorization === undefined));
  });
  await withCms(() => ({ status: 404 }), async read => assert.equal(await read(), undefined));
  await withCms(() => ({ body: { data: [], meta: { pagination: { page: 1, pageSize: 100, pageCount: 0 } } } }), async read => assert.deepEqual(await read(), []));
  await withCms(() => ({ status: 500 }), async read => assert.rejects(read));
  await withCms(() => ({ body: { data: [], meta: { pagination: { page: 2, pageSize: 100, pageCount: 1 } } } }), async read => assert.rejects(read));
});
