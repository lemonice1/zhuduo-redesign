import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const cms = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(cms, '.cache', `arabic-tests-${process.pid}`);
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', path.join(cms, 'tsconfig.json'), '--outDir', output], { stdio: 'pipe' });
after(() => rmSync(output, { recursive: true, force: true }));
const { backfillArabic } = require(path.join(output, 'src/lib/backfill-arabic.js'));
const { backfillLanguage } = require(path.join(output, 'src/lib/backfill-language.js'));
const product = require('@modular/contracts/company-products.json').products[0];

function fixture({ existing = false, changed = false, unpublished = false, missingLocale = false, targetLocale = 'ar' } = {}) {
  const source = { ...product.en, customizableOptions: product.en.options, documentId: 'product-1', slug: product.slug, image: { id: 8 }, gallery: [{ id: 9 }], brochure: { id: 10 } };
  const calls = [];
  const arabic = existing ? { documentId: 'product-1', title: 'مسودة يدوية', locale: 'ar' } : null;
  return { calls, source, arabic, strapi: {
    db: { transaction: async run => run() },
    documents: uid => ({
      findFirst: async query => uid === 'api::product.product' && query.filters?.slug === product.slug && !unpublished ? source : null,
      findOne: async ({ locale, status }) => {
        if (missingLocale && locale === targetLocale) throw new Error('Target locale not configured');
        return locale === targetLocale ? arabic : { ...source, ...(changed && status === 'draft' ? { detail: 'Manually edited specification' } : {}) };
      },
      update: async request => { calls.push(['update', request]); return { documentId: 'product-1' }; },
      publish: async request => { calls.push(['publish', request]); return { entries: [{ locale: request.locale }] }; }
    })
  } };
}

test('preview works before the Arabic locale exists and performs no writes', async () => {
  const f = fixture({ missingLocale: true });
  const results = await backfillArabic(f.strapi, false, false);
  assert.equal(results[0].action, 'create');
  assert.deepEqual(f.calls, []);
});

test('backfill preserves existing Arabic drafts, edited English drafts and unpublished products', async () => {
  for (const [options, action] of [[{ existing: true }, 'preserved'], [{ changed: true }, 'source-changed'], [{ unpublished: true }, 'source-missing']]) {
    const f = fixture(options);
    assert.equal((await backfillArabic(f.strapi, true))[0].action, action);
    assert.deepEqual(f.calls, []);
  }
});

test('backfill creates only the Arabic locale on the same document and preserves shared media', async () => {
  const f = fixture();
  const before = structuredClone(f.source);
  await backfillArabic(f.strapi, true);
  assert.equal(f.calls.length, 2);
  for (const [, request] of f.calls) {
    assert.equal(request.documentId, 'product-1');
    assert.equal(request.locale, 'ar');
  }
  const data = f.calls[0][1].data;
  assert.equal(data.slug, product.slug);
  assert.match(data.title, /[\u0600-\u06ff]/);
  for (const field of ['image', 'gallery', 'brochure', 'sortOrder', 'categoryKey']) assert.equal(Object.hasOwn(data, field), false);
  assert.deepEqual(f.source, before);
});

test('French backfill previews missing locale, preserves edits and writes only localized fields on the same document', async () => {
  const preview = fixture({ targetLocale: 'fr', missingLocale: true });
  assert.equal((await backfillLanguage(preview.strapi, 'fr', false, false))[0].action, 'create');
  assert.deepEqual(preview.calls, []);
  for (const [options, action] of [[{ existing: true }, 'preserved'], [{ changed: true }, 'source-changed'], [{ unpublished: true }, 'source-missing']]) {
    const f = fixture({ targetLocale: 'fr', ...options });
    assert.equal((await backfillLanguage(f.strapi, 'fr', true))[0].action, action);
    assert.deepEqual(f.calls, []);
  }
  const f = fixture({ targetLocale: 'fr' });
  const original = structuredClone(f.source);
  await backfillLanguage(f.strapi, 'fr', true);
  assert.equal(f.calls.length, 2);
  for (const [, request] of f.calls) {
    assert.equal(request.locale, 'fr');
    assert.equal(request.documentId, 'product-1');
  }
  const data = f.calls[0][1].data;
  assert.equal(data.title, 'Maison conteneur extensible 20FT');
  assert.equal(data.slug, product.slug);
  for (const field of ['image', 'gallery', 'brochure', 'sortOrder', 'categoryKey']) assert.equal(Object.hasOwn(data, field), false);
  assert.deepEqual(f.source, original);
});

test('product-only repair excludes FAQs and site settings in preview and apply for both locales', async () => {
  for (const locale of ['fr', 'ar']) for (const apply of [false, true]) {
    const f = fixture({ targetLocale: locale });
    const documents = f.strapi.documents;
    f.strapi.documents = uid => {
      assert.equal(uid, 'api::product.product', 'product repair must not access other content types');
      return documents(uid);
    };
    const before = structuredClone(f.source);
    const results = await backfillLanguage(f.strapi, locale, apply, true, { productsOnly: true });
    assert.ok(results.length > 0);
    assert.ok(results.every(row => row.type === 'product'));
    assert.equal(results[0].action, 'create');
    assert.equal(f.calls.length, apply ? 2 : 0);
    assert.deepEqual(f.source, before);
    for (const [, request] of f.calls) {
      assert.equal(request.documentId, 'product-1');
      assert.equal(request.locale, locale);
    }
  }
});
