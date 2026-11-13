import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const cms = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(cms, '.cache', `seed-tests-${process.pid}`);
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', path.join(cms, 'tsconfig.json'), '--outDir', output], { stdio: 'pipe' });
after(() => rmSync(output, { recursive: true, force: true }));
const seed = require(path.join(output, 'src/seed.js'));
const demo = require('@modular/contracts/demo-content.json');
const catalogue = require('@modular/contracts/company-products.json');

function fixture() {
  const records = Object.fromEntries(demo.faqs.map(([question, answer], index) => [`faq-${index}`, { en: { documentId: `faq-${index}`, question, answer, locale: 'en', publishedAt: '2026-10-10' } }]));
  const writes = [];
  const locales = new Set(['en']);
  return { records, writes, locales, strapi: {
    plugin: () => ({ service: () => ({ findByCode: async code => locales.has(code) ? { code } : null, create: async ({ code }) => { locales.add(code); writes.push(['locale', code]); } }) }),
    db: { transaction: async work => work({}) },
    documents: uid => uid !== 'api::faq.faq' ? { findFirst: async ({ filters } = {}) => catalogue.retiredProductSlugs.includes(filters?.slug) ? null : ({ documentId: 'already-seeded' }) } : {
      findFirst: async ({ filters, locale = 'en' }) => Object.values(records).map(row => row[locale]).find(row => row?.question === filters.question) ?? null,
      findOne: async ({ documentId, locale }) => records[documentId]?.[locale] ?? null,
      update: async ({ documentId, locale, data }) => { writes.push(['update', documentId, locale]); records[documentId][locale] = { documentId, locale, ...data }; return records[documentId][locale]; },
      publish: async ({ documentId, locale }) => { writes.push(['publish', documentId, locale]); records[documentId][locale].publishedAt = 'now'; }
    }
  } };
}

async function inDevelopment(work, mode = 'development', enabled = 'true') {
  const previous = { NODE_ENV: process.env.NODE_ENV, SEED_DEMO_CONTENT: process.env.SEED_DEMO_CONTENT };
  process.env.NODE_ENV = mode; process.env.SEED_DEMO_CONTENT = enabled;
  try { return await work(); } finally {
    for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
}

test('development initializes content locales before seeding without duplicating them', async () => inDevelopment(async () => {
  const f = fixture();
  await seed.prepareDevelopmentLocales(f.strapi);
  await seed.prepareDevelopmentLocales(f.strapi);
  assert.deepEqual([...f.locales], ['en', 'zh-Hans']);
  assert.deepEqual(f.writes, [['locale', 'zh-Hans']]);
}));

test('backfills published Chinese FAQ translations on the existing English document IDs once', async () => inDevelopment(async () => {
  const f = fixture();
  await seed.seedDevelopmentContent(f.strapi);
  assert.equal(Object.keys(f.records).length, 4);
  for (const row of Object.values(f.records)) {
    assert.equal(row['zh-Hans'].documentId, row.en.documentId);
    assert.match(row['zh-Hans'].question, /[\u4e00-\u9fff]/);
    assert.ok(row['zh-Hans'].publishedAt);
    assert.equal(row.en.locale, 'en');
  }
  const count = f.writes.length;
  await seed.seedDevelopmentContent(f.strapi);
  assert.equal(f.writes.length, count, 'restarts must not overwrite or republish FAQ content');
  const controller = require(path.join(output, 'src/api/site-setting/controllers/site-setting.js')).default({ strapi: {
    documents: uid => ({
      findMany: async ({ locale, status }) => uid === 'api::faq.faq' && status === 'published' ? Object.values(f.records).map(row => row[locale]).filter(row => row?.publishedAt) : [],
      findFirst: async () => null
    })
  } });
  const homepage = await controller.homepage({ query: { locale: 'zh-Hans' } });
  assert.equal(homepage.faqs.length, 4);
  assert.equal(homepage.faqs[0][0], '可以定制哪些内容？');
}));

test('preserves manually edited English content and existing Chinese drafts', async () => inDevelopment(async () => {
  const f = fixture();
  f.records['faq-0'].en.answer = 'Manually changed answer';
  f.records['faq-1']['zh-Hans'] = { documentId: 'faq-1', locale: 'zh-Hans', question: '人工草稿', answer: '待审查' };
  await seed.seedDevelopmentContent(f.strapi);
  assert.equal(f.records['faq-0']['zh-Hans'], undefined);
  assert.deepEqual(f.records['faq-1']['zh-Hans'], { documentId: 'faq-1', locale: 'zh-Hans', question: '人工草稿', answer: '待审查' });
  assert.ok(!f.writes.some(([, id]) => ['faq-0', 'faq-1'].includes(id)));
}));

test('production and disabled demo seeding never change locales or publish FAQ translations', async () => {
  for (const [mode, enabled] of [['production', 'true'], ['development', 'false']]) await inDevelopment(async () => {
    const f = fixture();
    await seed.prepareDevelopmentLocales(f.strapi);
    await seed.seedDevelopmentContent(f.strapi);
    assert.deepEqual(f.writes, []);
  }, mode, enabled);
});
