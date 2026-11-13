import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const cms = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(cms, '.cache', `company-products-${process.pid}`);
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', path.join(cms, 'tsconfig.json'), '--outDir', output], { stdio: 'pipe' });
after(() => rmSync(output, { recursive: true, force: true }));
const seed = require(path.join(output, 'src/seed.js'));
const catalogue = require('@modular/contracts/company-products.json');
const demo = require('@modular/contracts/demo-content.json');

function fixture() {
  const records = new Map();
  const writes = [];
  let nextId = 1;
  const api = {
    findFirst: async ({ filters, locale = 'en', status }) => [...records.values()].find(row => row.slug === filters.slug && row.locale === locale && row.status === status) ?? null,
    findOne: async ({ documentId, locale, status }) => records.get(`${documentId}:${locale}:${status}`) ?? null,
    create: async ({ locale, status, data }) => {
      const documentId = `product-${nextId++}`;
      const row = { ...structuredClone(data), documentId, locale, status: 'draft' };
      records.set(`${documentId}:${locale}:draft`, row); writes.push(['create', documentId, locale]);
      if (status === 'published') await api.publish({ documentId, locale });
      return row;
    },
    update: async ({ documentId, locale, data }) => {
      const row = { ...records.get(`${documentId}:${locale}:draft`), ...structuredClone(data), documentId, locale, status: 'draft' };
      records.set(`${documentId}:${locale}:draft`, row); writes.push(['update', documentId, locale]); return row;
    },
    publish: async ({ documentId, locale }) => {
      if (fixture.failLocale === locale) throw new Error('Publish failed');
      const row = records.get(`${documentId}:${locale}:draft`);
      records.set(`${documentId}:${locale}:published`, { ...structuredClone(row), status: 'published' });
      writes.push(['publish', documentId, locale]);
    },
    unpublish: async ({ documentId, locale }) => { records.delete(`${documentId}:${locale}:published`); writes.push(['unpublish', documentId, locale]); }
  };
  return { records, writes, api, strapi: {
    documents: () => api,
    db: { transaction: async work => {
      const before = structuredClone(records), count = writes.length;
      try { return await work(); } catch (error) { records.clear(); for (const [key, value] of before) records.set(key, value); writes.splice(count); throw error; }
    } }
  } };
}

async function inDevelopment(work, mode = 'development', enabled = 'true') {
  const previous = { NODE_ENV: process.env.NODE_ENV, SEED_DEMO_CONTENT: process.env.SEED_DEMO_CONTENT };
  process.env.NODE_ENV = mode; process.env.SEED_DEMO_CONTENT = enabled;
  try { return await work(); } finally {
    fixture.failLocale = undefined;
    for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
}

test('imports all brochure products with published English and Chinese versions once', async () => inDevelopment(async () => {
  assert.equal(typeof seed.seedCompanyProducts, 'function', 'The company catalogue importer is available');
  const f = fixture();
  await seed.seedCompanyProducts(f.strapi);
  assert.equal([...f.records.values()].filter(row => row.status === 'published').length, catalogue.products.length * 2);
  for (const product of catalogue.products) {
    const en = await f.api.findFirst({ filters: { slug: product.slug }, locale: 'en', status: 'published' });
    const zh = await f.api.findFirst({ filters: { slug: product.slug }, locale: 'zh-Hans', status: 'published' });
    assert.equal(en.title, product.en.title);
    assert.equal(zh.title, product['zh-Hans'].title);
    assert.equal(en.documentId, zh.documentId);
    assert.equal(en.imageUrl, product.imageUrl);
    assert.equal(zh.imageUrl, product.imageUrl);
    assert.equal(en.categoryKey, product.categoryKey);
    assert.equal(zh.categoryKey, en.categoryKey);
  }
  const count = f.writes.length;
  await seed.seedCompanyProducts(f.strapi);
  assert.equal(f.writes.length, count, 'Restarting must not overwrite or republish products');
}));

test('retires only untouched demo publications and preserves manual edits and drafts', async () => inDevelopment(async () => {
  const f = fixture();
  const original = demo.products[0];
  const data = { slug: original.slug, title: original.title, summary: original.summary, category: original.category, detail: original.detail, customizableOptions: original.options, imageUrl: '' };
  const retired = await f.api.create({ locale: 'en', status: 'published', data });
  const edited = await f.api.create({ locale: 'en', status: 'published', data: { ...data, slug: demo.products[1].slug, title: 'Our custom product' } });
  const custom = await f.api.create({ locale: 'en', data: { slug: catalogue.products[0].slug, ...catalogue.products[0].en, title: 'Unpublished editorial draft' } });
  await seed.seedCompanyProducts(f.strapi);
  assert.equal(await f.api.findOne({ documentId: retired.documentId, locale: 'en', status: 'published' }), null);
  assert.ok(await f.api.findOne({ documentId: retired.documentId, locale: 'en', status: 'draft' }), 'Old content remains recoverable');
  assert.ok(await f.api.findOne({ documentId: edited.documentId, locale: 'en', status: 'published' }));
  assert.equal(await f.api.findOne({ documentId: custom.documentId, locale: 'en', status: 'published' }), null);
  assert.equal((await f.api.findOne({ documentId: custom.documentId, locale: 'en', status: 'draft' })).title, 'Unpublished editorial draft');
}));

test('a translation publication failure rolls back catalogue replacement', async () => inDevelopment(async () => {
  const f = fixture(); fixture.failLocale = 'zh-Hans';
  await assert.rejects(seed.seedCompanyProducts(f.strapi), /Publish failed/);
  assert.equal(f.records.size, 0);
  assert.deepEqual(f.writes, []);
}));

test('retires the five removed capsule models in both languages, preserving D7 and drafts', async () => inDevelopment(async () => {
  const f = fixture();
  const retired = [];
  for (const model of ['d5', 'd6', 'd9', 'd2', 'd8']) {
    const english = await f.api.create({ locale: 'en', status: 'published', data: { slug: `space-capsule-${model}`, title: `Edited ${model}` } });
    await f.api.update({ documentId: english.documentId, locale: 'zh-Hans', data: { slug: `edited-chinese-${model}`, title: '已编辑的中文版本' } });
    await f.api.publish({ documentId: english.documentId, locale: 'zh-Hans' });
    retired.push(english.documentId);
  }
  await seed.seedCompanyProducts(f.strapi);
  for (const documentId of retired) for (const locale of ['en', 'zh-Hans']) {
    assert.equal(await f.api.findOne({ documentId, locale, status: 'published' }), null);
    assert.ok(await f.api.findOne({ documentId, locale, status: 'draft' }));
  }
  assert.deepEqual(catalogue.products.filter(product => product.slug.startsWith('space-capsule-')).map(product => product.slug), ['space-capsule-d7']);
  assert.ok(await f.api.findFirst({ filters: { slug: 'space-capsule-d7' }, locale: 'en', status: 'published' }));
  const count = f.writes.length;
  await seed.seedCompanyProducts(f.strapi);
  assert.equal(f.writes.length, count, 'Restarts must not republish retired models or rewrite remaining products');
}));

test('backfilling Chinese preserves the shared editorial order and existing Chinese drafts', async () => inDevelopment(async () => {
  const f = fixture();
  const makeData = product => ({ slug: product.slug, ...product.en, customizableOptions: product.en.options, imageUrl: product.imageUrl, sortOrder: 77 });
  const english = await f.api.create({ locale: 'en', status: 'published', data: makeData(catalogue.products[0]) });
  const withDraft = await f.api.create({ locale: 'en', status: 'published', data: makeData(catalogue.products[1]) });
  await f.api.update({ documentId: withDraft.documentId, locale: 'zh-Hans', data: { title: '人工审阅中的译文', sortOrder: 77 } });
  await seed.seedCompanyProducts(f.strapi);
  assert.equal((await f.api.findOne({ documentId: english.documentId, locale: 'zh-Hans', status: 'published' })).sortOrder, 77);
  assert.equal((await f.api.findOne({ documentId: withDraft.documentId, locale: 'zh-Hans', status: 'draft' })).title, '人工审阅中的译文');
  assert.equal(await f.api.findOne({ documentId: withDraft.documentId, locale: 'zh-Hans', status: 'published' }), null);
}));

test('production and disabled development seeding leave product publications untouched', async () => {
  for (const [mode, enabled] of [['production', 'true'], ['development', 'false']]) await inDevelopment(async () => {
    const f = fixture(); await seed.seedCompanyProducts(f.strapi); assert.deepEqual(f.writes, []);
  }, mode, enabled);
});
