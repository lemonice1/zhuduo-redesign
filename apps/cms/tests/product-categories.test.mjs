import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const cms = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(cms, '.cache', `category-tests-${process.pid}`);
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', path.join(cms, 'tsconfig.json'), '--outDir', output], { stdio: 'pipe' });
after(() => rmSync(output, { recursive: true, force: true }));
const { registerProductCategories, seedProductCategories, canonicalCategoryKey } = require(path.join(output, 'src/lib/product-categories.js'));
const defaults = require('@modular/contracts/managed-product-categories.json');
const categoryUid = 'api::product-category.product-category';
const productUid = 'api::product.product';
const custom = { documentId: 'garden', key: 'garden-rooms', slug: 'garden-rooms', nameEn: 'Garden Rooms', division: 'modular-buildings', group: 'none', visible: true };

function fixture({ categories = [custom], products = [], oldProduct = null, seeded = false } = {}) {
  let middleware, marker = seeded;
  const stored = structuredClone(categories), creates = [], locks = [];
  const strapi = {
    contentTypes: { [categoryUid]: {} },
    store: () => ({ get: async () => marker, set: async ({ value }) => { marker = value; } }),
    db: {
      transaction: async work => work({ trx: 'transaction' }),
      connection: { raw: (sql, parameters) => ({ transacting: async trx => { locks.push({ sql, parameters, trx }); } }) },
      query: () => ({ findMany: async () => products })
    },
    documents: Object.assign(uid => uid === productUid ? { findOne: async () => oldProduct } : {
      findOne: async ({ documentId }) => stored.find(row => row.documentId === documentId),
      findFirst: async ({ filters, status }) => stored.find(row => row.key === filters.key && !(status === 'published' && row.draftOnly)),
      create: async ({ data, status }) => { creates.push({ data, status }); stored.push({ ...data }); }
    }, { use: fn => { middleware = fn; } })
  };
  registerProductCategories(strapi);
  return { strapi, stored, creates, locks, run: (uid, action, params = {}) => middleware({ uid, action, params }, async () => params.data || 'done') };
}

test('new categories derive their internal key, validate paths and retain saved URL identity', async () => {
  const f = fixture();
  const data = { ...custom, key: 'forged-key' }; delete data.documentId;
  assert.equal((await f.run(categoryUid, 'create', { data })).key, 'garden-rooms');
  const baseline = { ...defaults.find(row => row.key === 'expandable-homes'), key: 'forged-key' };
  assert.equal((await f.run(categoryUid, 'create', { data: baseline })).key, 'expandable-homes');
  assert.equal((await f.run(categoryUid, 'clone', { documentId: 'garden', data: { slug: 'garden-copy' } })).key, 'garden-copy');
  await f.run(categoryUid, 'update', { documentId: 'garden', data: { nameEn: 'Updated garden', sortOrder: -10, visible: false } });
  for (const data of [{ slug: 'new-url' }, { division: 'electrical' }, { group: 'transformers' }]) await assert.rejects(() => f.run(categoryUid, 'update', { documentId: 'garden', data }), /固定|房屋/);
  for (const data of [{ ...custom, slug: '../unsafe' }, { ...custom, division: 'electrical', slug: 'switchgear' }, { ...custom, group: 'transformers' }]) await assert.rejects(() => f.run(categoryUid, 'create', { data }));
  assert.ok(f.locks.every(lock => lock.trx === 'transaction'));
});

test('category removal checks draft, translated and legacy product references while hiding stays allowed', async () => {
  const samples = [
    [custom, { categoryKey: 'garden-rooms', locale: 'fr', publishedAt: null }],
    [defaults.find(row => row.key === 'dry-type-transformers'), { slug: 'scb10-10kv-250kva', categoryKey: 'distribution-transformers' }],
    [defaults.find(row => row.key === 'prefabricated-substations'), { slug: 'substation-prefabricated', categoryKey: 'substations' }],
    [defaults.find(row => row.key === 'expandable-homes'), { slug: 'expandable-20ft', category: '' }]
  ];
  for (const [category, product] of samples) {
    const f = fixture({ categories: [{ ...category, documentId: 'garden' }], products: [product] });
    for (const action of ['delete', 'unpublish']) await assert.rejects(() => f.run(categoryUid, action, { documentId: 'garden' }), /关联产品/);
    await f.run(categoryUid, 'update', { documentId: 'garden', data: { visible: false } });
  }
  assert.equal(await fixture().run(categoryUid, 'delete', { documentId: 'garden' }), 'done');
});

test('new product assignments require a published category without rewriting untouched historical products', async () => {
  const f = fixture();
  await f.run(productUid, 'create', { data: { slug: 'new-garden', categoryKey: custom.key } });
  await assert.rejects(() => f.run(productUid, 'create', { data: { categoryKey: 'missing' } }), /尚未发布/);
  const drafts = fixture({ categories: [{ ...custom, draftOnly: true }] });
  await assert.rejects(() => drafts.run(productUid, 'create', { data: { categoryKey: custom.key } }), /尚未发布/);
  const historical = fixture({ oldProduct: { categoryKey: 'unknown-old', title: 'Existing' } });
  await historical.run(productUid, 'update', { documentId: 'existing', data: { title: 'Edited' } });
  await assert.rejects(() => historical.run(productUid, 'publish', { documentId: 'existing' }), /尚未发布/);
  assert.equal(canonicalCategoryKey({ slug: 'scb10-10kv-250kva', categoryKey: 'garden-rooms' }), custom.key);
});

test('initial category import is idempotent and never overwrites edits or restores intentional deletions', async () => {
  const existing = { ...defaults[0], nameEn: 'Business edited name', visible: false };
  const f = fixture({ categories: [existing] });
  await seedProductCategories(f.strapi);
  assert.equal(f.creates.length, defaults.length - 1);
  assert.equal(f.stored[0].nameEn, existing.nameEn);
  assert.ok(f.creates.every(row => row.status === 'published'));
  f.stored.length = 0;
  await seedProductCategories(f.strapi);
  assert.equal(f.stored.length, 0);
  assert.equal(f.creates.length, defaults.length - 1);
});
