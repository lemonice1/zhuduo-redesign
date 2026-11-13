import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './compiled-web.mjs';

const product = (slug, extra = {}) => ({ slug, title: slug, category: '', eyebrow: '', summary: '', detail: '', options: [], tone: '', imageUrl: '', ...extra });
const group = (...args) => load('lib/inquiry-directions.js').inquiryDirectionGroups(...args);

test('inquiry choices group CMS models and category keys without changing submitted identifiers', () => {
  const groups = group([
    product('new-transformer', { categoryKey: 'power-transformers', title: 'Custom model' }),
    product('space-capsule-d7', { title: 'D7' })
  ], [{ value: 'power-transformers', title: 'محولات القدرة' }, { value: 'space-capsules', title: 'كبسولات سكنية' }], 'ar');
  assert.deepEqual(groups.map(item => item.title), ['المعدات الكهربائية', 'المنازل المعيارية']);
  assert.deepEqual(groups[0].categories, [{ value: 'power-transformers', title: 'محولات القدرة' }]);
  assert.deepEqual(groups[0].models, [{ value: 'new-transformer', title: 'Custom model' }]);
  assert.deepEqual(groups[1].models, [{ value: 'space-capsule-d7', title: 'D7' }]);
});

test('inquiry choices keep unknown or explicitly invalid classifications selectable without guessing', () => {
  const groups = group([
    product('old-model'),
    product('expandable-20ft', { categoryKey: 'invalid', category: 'Expandable Container Houses' })
  ], [{ value: 'custom-project', title: 'Custom project' }], 'en');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, 'Other products');
  assert.deepEqual(groups[0].models.map(item => item.value), ['old-model', 'expandable-20ft']);
  assert.equal(groups[0].categories[0].value, 'custom-project');
});

test('unpublished locales retain category choices without adding models from another language', () => {
  const { divisions } = load('lib/catalogue.js');
  const directions = divisions.flatMap(division => division.categories.map(category => ({ value: category.slug, title: category.name.ar })));
  const groups = group([], directions, 'ar');
  assert.deepEqual(groups.map(item => item.categories.length), [11, 8]);
  assert.ok(groups[0].categories.some(item => item.value === 'special-transformers'));
  assert.ok(groups[0].categories.some(item => item.value === 'prefabricated-substations'));
  assert.ok(groups.every(item => !item.models.length));
  assert.deepEqual(group([], [], 'en'), []);
});

test('duplicate keys and model/category collisions yield one selectable value', () => {
  const groups = group([product('power-transformers'), product('power-transformers', { title: 'Latest title' })], [
    { value: 'power-transformers', title: 'Category collision' },
    { value: 'space-capsules', title: 'Old label' },
    { value: 'space-capsules', title: 'Space Capsules' }
  ], 'en');
  const options = groups.flatMap(item => [...item.categories, ...item.models]);
  assert.equal(options.length, 2);
  assert.equal(options.find(item => item.value === 'power-transformers').title, 'Latest title');
  assert.equal(options.find(item => item.value === 'space-capsules').title, 'Space Capsules');
});
