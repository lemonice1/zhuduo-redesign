// Run only against a disposable Strapi database and storage bucket.
// Mount this file alongside the compiled CMS and prepared product bundle.
const assert = require('node:assert/strict');
const path = require('node:path');
async function main() {
  assert.equal(process.env.CATALOGUE_INTEGRATION_TEST, 'true');
  assert.match(process.env.DATABASE_NAME || '', /^test_/);
  const { createStrapi } = require('@strapi/strapi');
  const catalogue = require('@modular/contracts/company-products.json');
  const app = createStrapi({ appDir: process.cwd(), distDir: path.join(process.cwd(), 'dist') });
  try {
    await app.load();
    const documents = app.documents('api::product.product');
    if (process.argv.includes('--setup')) {
      const locales = app.plugin('i18n').service('locales');
      if (!await locales.findByCode('zh-Hans')) await locales.create({ code: 'zh-Hans', name: 'Chinese (Simplified) (zh-Hans)' });
      const original = catalogue.legacyProducts[0]; let documentId;
      for (const locale of ['en', 'zh-Hans']) {
        const copy = original[locale];
        const data = { slug: original.slug, title: copy.title, summary: copy.summary, category: copy.category, detail: copy.detail, customizableOptions: copy.options, imageUrl: original.imageUrl, sortOrder: 77 };
        const row = documentId ? await documents.update({ documentId, locale, data }) : await documents.create({ locale, data });
        documentId = row.documentId; await documents.publish({ documentId, locale });
      }
      console.log('PASS: untouched bilingual legacy product prepared in disposable database'); return;
    }
    const populate = ['image', 'gallery', 'brochure'];
    for (const product of catalogue.products) {
      const en = await documents.findFirst({ filters: { slug: product.slug }, locale: 'en', status: 'published', populate });
      const zh = await documents.findFirst({ filters: { slug: product.slug }, locale: 'zh-Hans', status: 'published', populate });
      assert.ok(en && zh, product.slug); assert.equal(en.documentId, zh.documentId, product.slug);
      assert.equal(en.title, product.en.title); assert.equal(zh.title, product['zh-Hans'].title);
      assert.ok(en.image?.url, product.slug); assert.equal(en.image.provider, 'aws-s3');
      assert.equal(en.gallery.length, product.galleryUrls.length);
      if (product.brochureKey) assert.equal(en.brochure.mime, 'application/pdf');
      assert.equal(en.imageUrl, '');
    }
    const { importCompanyCatalogue } = require(path.join(process.cwd(), 'dist/src/lib/catalogue-import.js'));
    const forbidUpload = async () => { throw new Error('Unchanged import must not upload'); };
    const repeated = await importCompanyCatalogue(app, catalogue, { apply: true, uploadAsset: forbidUpload });
    assert.ok(repeated.every(item => item.action === 'unchanged'));
    const controller = app.controller('api::product.product');
    const ctx = locale => ({ query: { locale, status: 'draft', populate: '*', 'fields': '*', pagination: { page: 1, pageSize: 100 } }, badRequest: message => { throw new Error(message); } });
    const firstPage = await controller.find(ctx('en'));
    assert.equal(firstPage.meta.pagination.total, catalogue.products.length);
    assert.equal(firstPage.data.length, 100);
    const page2 = ctx('en'); page2.query.pagination.page = 2;
    assert.equal((await controller.find(page2)).data.length, catalogue.products.length - 100);
    for (const product of firstPage.data) {
      assert.ok(product.image?.url); assert.ok(!('catalogueImportState' in product)); assert.ok(!('sourceReference' in product));
    }
    const ac01 = await documents.findFirst({ filters: { slug: 'apple-cabin-ac01' }, locale: 'en', populate });
    const ac02 = await documents.findFirst({ filters: { slug: 'apple-cabin-ac02' }, locale: 'en', populate });
    await documents.update({ documentId: ac01.documentId, locale: 'en', data: { title: 'Editorial AC01', image: ac02.image.id } });
    const preserved = await importCompanyCatalogue(app, catalogue, { apply: true, uploadAsset: forbidUpload });
    assert.equal(preserved.find(row => row.slug === 'apple-cabin-ac01').action, 'preserved');
    assert.equal((await documents.findOne({ documentId: ac01.documentId, locale: 'en', status: 'published' })).title, ac01.title);
    await documents.publish({ documentId: ac01.documentId, locale: 'en' });
    const publicOne = await controller.findOne({ query: { locale: 'en' }, params: { documentId: ac01.documentId }, notFound: () => { throw new Error('Missing public product'); } });
    assert.equal(publicOne.data.title, 'Editorial AC01'); assert.equal(publicOne.data.image.url, ac02.image.url);
    console.log(`PASS: ${catalogue.products.length} bilingual CMS documents, S3 images and PDFs, repeat import, public pagination and admin image replacement`);
  } finally { await require(path.join(process.cwd(), 'scripts/strapi-shutdown.cjs'))(app); }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
