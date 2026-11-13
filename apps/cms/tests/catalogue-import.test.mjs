import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const cms = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(cms, '.cache', `catalogue-import-${process.pid}`);
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', path.join(cms, 'tsconfig.json'), '--outDir', output], { stdio: 'pipe' });
after(() => rmSync(output, { recursive: true, force: true }));

function fixture() {
  const records = new Map(); let id = 0; const uploads = []; const writes = [];
  const api = {
    findFirst: async ({ filters, locale, status }) => [...records.values()].find(r => r.slug === filters.slug && r.locale === locale && r.status === status) ?? null,
    findOne: async ({ documentId, locale, status }) => records.get(`${documentId}:${locale}:${status}`) ?? null,
    create: async ({ locale, data }) => api.update({ documentId: `doc-${++id}`, locale, data }),
    update: async ({ documentId, locale, data }) => {
      const row = { ...records.get(`${documentId}:${locale}:draft`), ...structuredClone(data), documentId, locale, status: 'draft' };
      for (const key of ['image', 'brochure']) if (typeof row[key] === 'number') row[key] = { id: row[key] };
      if (Array.isArray(row.gallery)) row.gallery = row.gallery.map(x => typeof x === 'number' ? { id: x } : x);
      records.set(`${documentId}:${locale}:draft`, row); writes.push([documentId, locale]); return row;
    },
    publish: async ({ documentId, locale }) => {
      if (fixture.failLocale === locale) throw new Error('Publish failed');
      records.set(`${documentId}:${locale}:published`, { ...structuredClone(records.get(`${documentId}:${locale}:draft`)), status: 'published' });
    }
  };
  return { records, writes, uploads, api, strapi: { documents: () => api, db: { transaction: async work => {
    const before = structuredClone(records);
    try { return await work(); } catch (error) { records.clear(); for (const [k,v] of before) records.set(k,v); throw error; }
  } } }, uploadAsset: async key => { uploads.push(key); return uploads.length; } };
}
const translated = title => ({ title, summary: 'Published summary', category: 'Apple Cabins', detail: 'Confirmed specification', options: ['Layout'] });
const manifest = { version: 'test', assets: {}, brochures: {}, legacyProducts: [], products: [{ slug: 'apple-ac01', categoryKey: 'apple-cabins', imageUrl: '/cover.webp', galleryUrls: ['/inside.webp'], source: { document: 'Apple.pdf', page: 2 }, en: translated('AC01'), 'zh-Hans': translated('AC01 苹果舱') }] };
const run = async (f, apply = false, source = manifest) => {
  const { importCompanyCatalogue } = require(path.join(output, 'src/lib/catalogue-import.js'));
  return importCompanyCatalogue(f.strapi, source, { apply, uploadAsset: f.uploadAsset });
};

test('dry-run plans bilingual products without database writes or uploads', async () => {
  const f = fixture(); const result = await run(f);
  assert.equal(result[0].action, 'create'); assert.deepEqual(f.writes, []); assert.deepEqual(f.uploads, []);
});
test('explicit import links two locales and uploaded media to one CMS document, and reruns do nothing', async () => {
  const f = fixture(); await run(f, true);
  const en = await f.api.findFirst({ filters: { slug: 'apple-ac01' }, locale: 'en', status: 'published' });
  const zh = await f.api.findFirst({ filters: { slug: 'apple-ac01' }, locale: 'zh-Hans', status: 'published' });
  assert.equal(en.documentId, zh.documentId); assert.equal(zh.title, 'AC01 苹果舱'); assert.equal(en.image.id, 1); assert.deepEqual(en.gallery, [{ id: 2 }]);
  const count = f.writes.length; const uploads = f.uploads.length;
  assert.equal((await run(f, true))[0].action, 'unchanged'); assert.equal(f.writes.length, count); assert.equal(f.uploads.length, uploads);
});
test('manual edits, unpublished records and slug conflicts are preserved in every locale', async () => {
  for (const edit of ['draft', 'unpublish', 'unmanaged']) {
    const f = fixture();
    if (edit === 'unmanaged') await f.api.create({ locale: 'en', data: { slug: 'apple-ac01', title: 'Existing editorial product' } });
    else {
      await run(f, true);
      if (edit === 'draft') await f.api.update({ documentId: 'doc-1', locale: 'zh-Hans', data: { title: '人工修订' } });
      else f.records.delete('doc-1:en:published');
    }
    const before = structuredClone(f.records); const count = f.uploads.length;
    assert.equal((await run(f, true))[0].action, 'preserved'); assert.deepEqual(f.records, before); assert.equal(f.uploads.length, count);
  }
});
test('failed Chinese publication rolls back both product locales', async () => {
  const f = fixture(); fixture.failLocale = 'zh-Hans';
  try { await assert.rejects(run(f, true), /Publish failed/); assert.equal(f.records.size, 0); }
  finally { fixture.failLocale = undefined; }
});
test('changed photo bytes update untouched imports, while administrator edits remain protected', async () => {
  const f = fixture(); const source = structuredClone(manifest);
  source.assets['/cover.webp'] = { sha256: 'original-photo' };
  await run(f, true, source);
  source.assets['/cover.webp'].sha256 = 'cleaned-photo';
  assert.equal((await run(f, false, source))[0].action, 'update');
  await run(f, true, source);
  assert.equal((await run(f, false, source))[0].action, 'unchanged');
  await f.api.update({ documentId: 'doc-1', locale: 'en', data: { image: 999 } });
  source.assets['/cover.webp'].sha256 = 'another-photo';
  assert.equal((await run(f, true, source))[0].action, 'preserved');
});
test('untouched development seeds are upgraded to CMS media without replacing their document ID or order', async () => {
  const f = fixture(); const p = manifest.products[0]; let documentId;
  for (const locale of ['en', 'zh-Hans']) {
    const copy = p[locale];
    const data = { slug: p.slug, title: copy.title, summary: copy.summary, category: copy.category, categoryKey: p.categoryKey, detail: copy.detail, customizableOptions: copy.options, imageUrl: p.imageUrl, sortOrder: 77 };
    const row = documentId ? await f.api.update({ documentId, locale, data }) : await f.api.create({ locale, data });
    documentId = row.documentId; await f.api.publish({ documentId, locale });
  }
  assert.equal((await run(f, true))[0].action, 'update');
  const row = await f.api.findOne({ documentId, locale: 'en', status: 'published' });
  assert.equal(row.sortOrder, 77); assert.equal(row.imageUrl, ''); assert.equal(row.image.id, 1);
});
