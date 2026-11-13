// Replace only the isolated local housing catalogue. Media and unrelated content are preserved.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { parseArgs } = require('node:util');
const productUid = 'api::product.product', categoryUid = 'api::product-category.product-category';
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const hash = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest('hex');

async function main() {
  const { values } = parseArgs({ options: { bundle: { type: 'string' }, apply: { type: 'boolean', default: false }, verify: { type: 'boolean', default: false } } });
  if (!values.bundle) throw Error('Pass --bundle with the extracted housing catalogue directory. Default is a read-only audit; --apply replaces local housing data.');
  const root = path.resolve(__dirname, '../../..');
  const cmsDir = path.join(root, 'apps/cms');
  const env = require('dotenv').parse(await fs.readFile(path.join(cmsDir, '.env')));
  assert.equal(env.DATABASE_HOST, '127.0.0.1'); assert.equal(env.DATABASE_PORT, '5433');
  assert.equal(env.DATABASE_NAME, 'zhuduo_local'); assert.equal(env.PUBLIC_URL, 'http://localhost:1337');
  assert.ok(!env.DATABASE_URL, 'DATABASE_URL would override the isolated local database');
  for (const key of ['S3_ENDPOINT', 'MEDIA_PUBLIC_URL']) if (env[key]) assert.ok(['localhost', '127.0.0.1'].includes(new URL(env[key]).hostname), 'Local media only');
  const manifestFile = path.join(root, 'docs/content/housing-products-2026-11.json');
  const manifestBytes = await fs.readFile(manifestFile);
  const manifest = JSON.parse(manifestBytes);
  const bundle = await fs.realpath(values.bundle);
  assert.equal(manifest.categories.length, 6); assert.equal(manifest.products.length, 12);
  const targetKeys = new Set(manifest.categories.map(c => c.key));
  const targetSlugs = new Set(manifest.products.map(p => p.slug));
  assert.equal(targetSlugs.size, 12);
  const assets = new Map();
  for (const product of manifest.products) {
    assert.ok(targetKeys.has(product.categoryKey));
    for (const locale of ['en', 'fr', 'ar']) {
      const data = product.locales[locale];
      assert.ok(data.title && data.summary && data.detail);
      assert.ok(!/[\u4e00-\u9fff]/.test(JSON.stringify(data)), `Untranslated public content: ${product.slug}/${locale}`);
    }
    for (const media of product.media) {
      const file = await fs.realpath(path.join(bundle, media.file));
      assert.ok(file.startsWith(bundle + path.sep), 'Asset outside bundle');
      assert.equal(hash(await fs.readFile(file)), media.sha256, `Asset checksum: ${media.file}`);
      assets.set(media.file, { ...media, file });
    }
  }
  const cache = path.join(root, '.cache/housing-replacement');
  const beforeFile = path.join(cache, 'before.json');
  const stateFile = path.join(cache, 'state.json');
  const state = await fs.readFile(stateFile, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return { uploads: {} }; throw error; });
  const save = () => fs.writeFile(stateFile, JSON.stringify(state, null, 2));
  Object.assign(process.env, env, { SEED_DEMO_CONTENT: 'false', STRAPI_TELEMETRY_DISABLED: 'true' });
  process.chdir(cmsDir);
  const app = require('@strapi/strapi').createStrapi({ appDir: cmsDir, distDir: path.join(cmsDir, 'dist') });
  try {
    await app.load();
    const { canonicalCategoryKey } = require(path.join(cmsDir, 'dist/src/lib/product-categories.js'));
    const read = async () => ({
      products: await app.db.query(productUid).findMany({ populate: ['image', 'gallery', 'brochure'], orderBy: { id: 'asc' } }),
      categories: await app.db.query(categoryUid).findMany({ orderBy: { id: 'asc' } })
    });
    const current = await read();
    const housingKeys = new Set(current.categories.filter(c => c.division === 'modular-buildings').map(c => c.key));
    const isHousing = p => housingKeys.has(canonicalCategoryKey(p));
    const otherProducts = rows => rows.filter(p => !isHousing(p));
    const otherCategories = rows => rows.filter(c => c.division !== 'modular-buildings');
    if (values.verify) {
      const before = JSON.parse(await fs.readFile(beforeFile, 'utf8'));
      const oldKeys = new Set(before.categories.filter(c => c.division === 'modular-buildings').map(c => c.key));
      assert.equal(hash(otherProducts(current.products)), hash(before.products.filter(p => !oldKeys.has(canonicalCategoryKey(p)))), 'Unrelated products changed');
      assert.deepEqual(otherCategories(current.categories), otherCategories(before.categories), 'Electrical categories changed');
      for (const locale of ['en', 'fr', 'ar']) {
        const rows = current.products.filter(p => isHousing(p) && p.locale === locale && p.publishedAt);
        assert.equal(rows.length, 12);
        assert.deepEqual(rows.map(p => p.slug).sort(), [...targetSlugs].sort());
        for (const product of manifest.products) {
          const row = rows.find(p => p.slug === product.slug);
          for (const [field, expected] of Object.entries(product.locales[locale])) assert.deepEqual(row[field], expected, `${locale}/${product.slug}/${field}`);
          assert.equal(row.categoryKey, product.categoryKey);
          assert.equal(row.image.id, state.uploads[product.media[0].file].id);
          assert.deepEqual(row.gallery.map(m => m.id), product.media.slice(1).map(m => state.uploads[m.file].id));
          assert.ok(row.sourceReference.includes(manifest.source.sha256));
        }
      }
      assert.ok(!current.products.some(p => isHousing(p) && !targetSlugs.has(p.slug)), 'Obsolete housing draft remains');
      assert.ok(!current.products.some(p => isHousing(p) && !['en', 'fr', 'ar'].includes(p.locale)), 'Obsolete housing language remains');
      for (const status of [false, true]) {
        const rows = current.categories.filter(c => c.division === 'modular-buildings' && Boolean(c.publishedAt) === status);
        assert.equal(rows.length, 6); assert.deepEqual(rows.map(c => c.key).sort(), [...targetKeys].sort());
      }
      console.log(JSON.stringify({ verified: true, housingCategories: 6, housingProductsPerLanguage: 12, locales: ['en', 'fr', 'ar'], media: Object.keys(state.uploads).length, otherProductsUnchanged: true, otherCategoriesUnchanged: true }));
      return;
    }
    if (!values.apply) {
      console.log(JSON.stringify({ dryRun: true, replaceHousingDocuments: new Set(current.products.filter(isHousing).map(p => p.documentId)).size, targetProducts: 12, targetCategories: 6, images: assets.size, preserveOtherDocuments: new Set(otherProducts(current.products).map(p => p.documentId)).size }));
      return;
    }
    await fs.mkdir(cache, { recursive: true });
    // A verified full database dump is mandatory before deleting any old document.
    const dump = await fs.readFile(path.join(cache, 'before.dump'));
    assert.equal(dump.subarray(0, 5).toString(), 'PGDMP');
    if (!await fs.stat(beforeFile).catch(() => null)) {
      await fs.writeFile(beforeFile, JSON.stringify({ ...current, at: new Date().toISOString(), otherHash: hash(otherProducts(current.products)), dumpSha256: hash(dump) }, null, 2));
    }
    const before = JSON.parse(await fs.readFile(beforeFile, 'utf8'));
    const oldKeys = new Set(before.categories.filter(c => c.division === 'modular-buildings').map(c => c.key));
    const preservedHash = hash(before.products.filter(p => !oldKeys.has(canonicalCategoryKey(p))));
    assert.equal(hash(otherProducts(current.products)), preservedHash, 'Unrelated data changed since backup; audit before proceeding');
    if (state.appliedHash) {
      assert.equal(state.manifestSha256, hash(manifestBytes), 'Manifest changed after import');
      const matches = current.products.filter(isHousing).length === 72 && manifest.products.every(product => ['en', 'fr', 'ar'].every(locale => [false, true].every(published => {
        const row = current.products.find(p => p.slug === product.slug && p.locale === locale && Boolean(p.publishedAt) === published);
        return row && row.categoryKey === product.categoryKey && row.sortOrder === product.sortOrder && row.featured === product.featured && row.image?.id === state.uploads[product.media[0].file]?.id && hash(row.gallery.map(m => m.id)) === hash(product.media.slice(1).map(m => state.uploads[m.file]?.id)) && Object.entries(product.locales[locale]).every(([field, expected]) => hash(row[field]) === hash(expected));
      }))) && current.categories.filter(c => c.division === 'modular-buildings').length === 12 && manifest.categories.every(({ sourceId, ...category }) => [false, true].every(published => {
        const row = current.categories.find(c => c.key === category.key && Boolean(c.publishedAt) === published);
        return row && Object.entries(category).every(([field, expected]) => hash(row[field]) === hash(expected));
      }));
      assert.ok(matches, 'CMS content edited after import; preserve business changes');
      console.log('Catalogue already imported; no writes performed.'); return;
    }
    // Upload and validate every asset before the atomic database replacement.
    for (const [key, media] of assets) {
      const name = `housing-${media.sha256}.jpg`;
      const existing = await app.db.query('plugin::upload.file').findOne({ where: { name } });
      if (existing) state.uploads[key] = { id: existing.id, url: existing.url, sha256: media.sha256 };
      else {
        const [file] = await app.plugin('upload').service('upload').upload({ data: { fileInfo: { name, alternativeText: media.caption, caption: media.caption } }, files: { filepath: media.file, originalFilename: name, mimetype: 'image/jpeg', size: (await fs.stat(media.file)).size } });
        state.uploads[key] = { id: file.id, url: file.url, sha256: media.sha256 };
      }
      await save();
    }
    for (const code of ['en', 'fr', 'ar']) if (!await app.plugin('i18n').service('locales').findByCode(code)) throw Error(`Missing configured locale: ${code}`);
    const doc = app.documents(productUid), cats = app.documents(categoryUid);
    await app.db.transaction(async () => {
      for (const { sourceId, ...data } of manifest.categories) {
        const existing = current.categories.find(c => c.key === data.key && !c.publishedAt);
        const row = existing ? await cats.update({ documentId: existing.documentId, data }) : await cats.create({ data });
        await cats.publish({ documentId: row.documentId });
      }
      const retained = new Set();
      for (const product of manifest.products) {
        const matching = current.products.filter(p => p.slug === product.slug);
        assert.ok(matching.every(isHousing), 'Refusing to overwrite another division');
        const ids = [...new Set(matching.map(p => p.documentId))]; assert.ok(ids.length <= 1, 'Duplicate slug across documents');
        let documentId = ids[0];
        const shared = { slug: product.slug, categoryKey: product.categoryKey, sortOrder: product.sortOrder, featured: product.featured, imageUrl: '', image: state.uploads[product.media[0].file].id, gallery: product.media.slice(1).map(m => state.uploads[m.file].id), brochure: null, sourceReference: JSON.stringify({ source: manifest.source, product: product.sourceRecord }), catalogueImportState: { version: manifest.version } };
        for (const locale of ['en', 'fr', 'ar']) {
          const data = { ...shared, ...product.locales[locale] };
          const result = documentId ? await doc.update({ documentId, locale, data }) : await doc.create({ locale, data });
          documentId = result.documentId;
          await doc.publish({ documentId, locale });
        }
        for (const locale of [...new Set(matching.map(p => p.locale))].filter(l => !['en', 'fr', 'ar'].includes(l))) await doc.delete({ documentId, locale });
        retained.add(documentId);
      }
      for (const documentId of [...new Set(current.products.filter(isHousing).map(p => p.documentId))]) if (!retained.has(documentId)) await doc.delete({ documentId, locale: '*' });
      for (const documentId of [...new Set(current.categories.filter(c => c.division === 'modular-buildings' && !targetKeys.has(c.key)).map(c => c.documentId))]) await cats.delete({ documentId });
      const after = await read();
      assert.equal(hash(otherProducts(after.products)), preservedHash, 'Transaction touched unrelated products');
      assert.deepEqual(otherCategories(after.categories), otherCategories(before.categories), 'Transaction touched electrical categories');
      for (const locale of ['en', 'fr', 'ar']) assert.equal(after.products.filter(p => targetKeys.has(canonicalCategoryKey(p)) && p.locale === locale && p.publishedAt).length, 12);
    });
    state.appliedHash = hash(await read()); state.manifestSha256 = hash(manifestBytes); state.appliedAt = new Date().toISOString(); state.dumpSha256 = hash(dump);
    await save();
    console.log(JSON.stringify({ applied: true, categories: 6, products: 12, locales: ['en', 'fr', 'ar'], images: assets.size, backup: path.join(cache, 'before.dump'), dumpSha256: state.dumpSha256 }));
  } finally { await require('./strapi-shutdown.cjs')(app); }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
