import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const catalogue = JSON.parse(readFileSync('packages/contracts/company-products.json', 'utf8'));
const taxonomy = JSON.parse(readFileSync('packages/contracts/product-taxonomy.json', 'utf8'));

test('company materials have unique bilingual CMS identities, real assets and explicit classifications', () => {
  assert.ok(catalogue.products.length >= 100, 'Import the supplied electrical models and housing brochures');
  const categories = new Set(taxonomy.divisions.flatMap(d => d.categories.map(c => c.slug)));
  const slugs = new Set();
  for (const product of catalogue.products) {
    assert.ok(!slugs.has(product.slug), product.slug); slugs.add(product.slug);
    assert.ok(categories.has(product.categoryKey), product.slug);
    assert.ok(product.source.document && product.source.page > 0 || product.source.files?.length, product.slug);
    for (const locale of ['en', 'zh-Hans']) for (const field of ['title', 'summary', 'category', 'detail']) assert.ok(product[locale][field]?.trim(), `${product.slug}:${locale}:${field}`);
    for (const url of [product.imageUrl, ...product.galleryUrls]) {
      assert.ok(existsSync(`apps/web/public${url}`), `${product.slug}: ${url}`);
      const asset = catalogue.assets[url];
      assert.equal(createHash('sha256').update(readFileSync(`apps/web/public${url}`)).digest('hex'), asset.sha256);
    }
  }
  assert.deepEqual(catalogue.products.filter(p => p.slug.startsWith('space-capsule-')).map(p => p.slug), ['space-capsule-d7']);
  assert.ok(catalogue.products.some(p => p.categoryKey === 'apple-cabins'));
});
