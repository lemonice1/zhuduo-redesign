import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { load } from './compiled-web.mjs';

const site = load('lib/site-architecture.js');
const product = (slug, categoryKey) => ({ slug, categoryKey, category: '', title: slug, summary: '', detail: '', eyebrow: '', imageUrl: '', tone: '', options: [] });

test('sitemap preserves Home and 34 destinations while Projects keeps Featured Projects', () => {
  assert.equal(site.siteNavigation.length, 7);
  assert.deepEqual(site.siteNavigation.map(item => item.slug), ['electrical', 'modular-buildings', 'applications', 'projects', 'resources', 'about', 'contact']);
  assert.equal(site.sitePage('').name.en, 'Home');
  assert.equal(site.sitePages().length, 34);
  for (const language of ['en', 'ar', 'fr']) {
    const hrefs = site.sitePages().map(({ path }) => site.siteHref(path, language));
    assert.equal(new Set(hrefs).size, 34);
    assert.ok(hrefs.every(href => href.endsWith(`?lang=${language}`) && !href.includes('/preview')));
    assert.equal(site.siteHref('electrical/transformers', language), `/products/electrical/transformers?lang=${language}`);
    assert.equal(site.siteHref('resources/faqs', language), `/resources/faqs?lang=${language}`);
    assert.equal(site.siteHref('', language), `/?lang=${language}`);
    for (const slug of ['featured-projects']) {
      assert.ok(site.sitePage(`projects/${slug}`).name[language]);
      assert.equal(site.siteHref(`projects/${slug}`, language), `/projects/${slug}?lang=${language}`);
    }
  }
  assert.equal(site.siteHref('electrical', 'en', true), '/preview/homepage/electrical?lang=en');
});

test('existing products are partitioned between the new electrical families without duplicating models', () => {
  const rows = [product('oil-10kv-1000kva', 'distribution-transformers'), product('scb10-10kv-250kva', 'distribution-transformers'), product('substation-yb', 'substations'), product('substation-prefabricated', 'substations'), product('custom-special', 'special-transformers'), product('custom-mv', 'mv-switchgear'), product('legacy-lv', 'lv-distribution')];
  assert.equal(site.siteProductCategoryPath(rows[1]), 'electrical/transformers/dry-type-transformers');
  assert.equal(site.siteProductCategoryPath(rows[3]), 'electrical/substations/prefabricated-substations');
  const leaves = site.sitePages().filter(({ path, node }) => path.startsWith('electrical/') && !node.children);
  const categorized = leaves.flatMap(({ path }) => site.siteProducts(path, rows).map(item => item.slug));
  assert.equal(categorized.length, rows.length);
  assert.equal(new Set(categorized).size, rows.length);
  assert.deepEqual(site.siteProducts('electrical/transformers/distribution-transformers', rows).map(item => item.slug), ['oil-10kv-1000kva']);
});

test('housing and legacy links preserve solar products and never guess unknown classifications', () => {
  const house = product('expandable-20ft', 'expandable-homes');
  assert.equal(site.siteProductHref(house, 'fr'), '/products/modular-buildings/expandable-houses/expandable-20ft?lang=fr');
  assert.equal(site.legacyCategoryPath('modular-housing', 'expandable-homes'), 'modular-buildings/expandable-houses');
  assert.equal(site.legacyCategoryPath('electrical', 'power-transformers'), 'electrical/transformers/power-transformers');
  const solar = product('solar-house', 'solar-homes');
  assert.ok(site.sitePage(site.siteProductCategoryPath(solar))?.name.en);
  assert.equal(site.siteProducts('modular-buildings', [solar]).length, 1);
  assert.equal(site.siteNavigation.find(item => item.slug === 'modular-buildings').children.length, 7);
  const unknown = product('unclassified', 'not-a-category');
  assert.equal(site.siteProductCategoryPath(unknown), '');
  assert.equal(site.siteProductHref(unknown, 'ar'), '/contact?lang=ar');
  assert.equal(site.siteProducts('modular-buildings', [unknown]).length, 0);
});

test('applications use published custom products and safe local reference images when the catalogue is empty', () => {
  const electrical = { ...product('custom-transformer', 'power-transformers'), imageUrl: 'https://media.example.org/power.jpg' };
  const housing = { ...product('custom-home', 'expandable-homes'), imageUrl: 'https://media.example.org/home.jpg' };
  assert.deepEqual(site.siteApplicationProducts('energy-utilities', [housing, electrical]), [electrical]);
  assert.deepEqual(site.siteApplicationProducts('residential-hospitality', [electrical, housing]), [housing]);
  assert.equal(site.siteApplicationImage('industrial-projects', [electrical]), electrical.imageUrl);
  for (const application of site.siteNavigation.find(item => item.slug === 'applications').children) {
    const image = site.siteApplicationImage(application.slug, []);
    assert.ok(existsSync(path.resolve('apps/web/public', image.slice(1))), image);
  }
  assert.deepEqual(site.siteApplicationProducts('unknown', [electrical]), []);
});
