import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const cms = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(cms, '.cache', `translation-tests-${process.pid}`);
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', path.join(cms, 'tsconfig.json'), '--outDir', output], { stdio: 'pipe' });
after(() => rmSync(output, { recursive: true, force: true }));
const client = () => require(path.join(output, 'src/lib/translation-client.js'));

async function apiFixture(t, respond) {
  const requests = [];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const request = { body: JSON.parse(body), authorization: req.headers.authorization };
    requests.push(request);
    await respond(res, request);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  return { requests, config: { enabled: true, apiUrl: `http://127.0.0.1:${server.address().port}/chat/completions`, apiKey: 'private-fixture-key', model: 'fixture-translator', timeoutMs: 1000 } };
}

function completion(res, translations, extra = {}) {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ translations }) }, ...extra }] }));
}

test('translates only string values and reconstructs the original JSON structure over real HTTP', async t => {
  const { config, requests } = await apiFixture(t, res => completion(res, ['折叠房屋', '布局', '深绿色']));
  const fields = { title: 'Folding home', customizableOptions: ['Layout', { color: 'Dark green', count: 3, optional: null }], detail: '' };
  const translated = await client().translateFields(config, 'en', 'zh-Hans', fields);
  assert.deepEqual(translated, { title: '折叠房屋', customizableOptions: ['布局', { color: '深绿色', count: 3, optional: null }], detail: '' });
  assert.equal(fields.title, 'Folding home', 'source must not be mutated');
  assert.equal(requests[0].authorization, 'Bearer private-fixture-key');
  assert.equal(requests[0].body.model, 'fixture-translator');
  assert.equal(requests[0].body.response_format.type, 'json_object');
  const payload = JSON.parse(requests[0].body.messages.at(-1).content);
  assert.equal(payload.sourceLocale, 'en');
  assert.equal(payload.targetLocale, 'zh-Hans');
  assert.deepEqual(payload.texts.map(item => item.text), ['Folding home', 'Layout', 'Dark green']);
});

for (const [name, respond] of [
  ['missing translations', res => completion(res, [])],
  ['blank translation', res => completion(res, [' '])],
  ['non-string translation', res => completion(res, [123])],
  ['truncated completion', res => completion(res, ['译文'], { finish_reason: 'length' })],
  ['malformed JSON', res => res.end('{bad json')],
  ['provider failure with sensitive body', res => { res.statusCode = 401; res.end('private-fixture-key provider diagnostics'); }],
  ['timeout', async res => { await new Promise(resolve => setTimeout(resolve, 100)); if (!res.destroyed) completion(res, ['译文']); }]
]) {
  test(`rejects ${name} without exposing credentials`, async t => {
    const { config } = await apiFixture(t, respond);
    if (name === 'timeout') config.timeoutMs = 20;
    await assert.rejects(client().translateFields(config, 'en', 'zh-Hans', { title: 'A home' }), error => {
      assert.ok(!error.message.includes(config.apiKey));
      assert.match(error.message, /翻译/);
      return true;
    });
  });
}

test('requires complete configuration and refuses oversized content before contacting the provider', async t => {
  const { config, requests } = await apiFixture(t, res => completion(res, ['译文']));
  await assert.rejects(client().translateFields({ ...config, apiKey: '' }, 'en', 'zh-Hans', { title: 'A home' }), /配置/);
  await assert.rejects(client().translateFields(config, 'en', 'zh-Hans', { body: 'x'.repeat(20001) }), /20,000/);
  assert.equal(requests.length, 0);
});

const admin = path.dirname(require.resolve('@strapi/admin/strapi-server'));
const cm = path.dirname(require.resolve('@strapi/content-manager/strapi-server'));
const i18n = path.dirname(require.resolve('@strapi/i18n/strapi-server'));
const core = path.dirname(require.resolve('@strapi/core'));
const { createMiddlewareManager } = require(path.join(core, 'services/document-service/middlewares/middleware-manager.js'));
const entityValidator = require(path.join(core, 'services/entity-validator/index.js'));
const permission = require(path.join(admin, 'server/src/services/permission.js'));
const { applicationTypes } = require(path.join(output, 'src/lib/application-pages.js'));
const publicNames = ['product', 'project-case', 'article', 'certificate', 'faq', 'site-setting', ...applicationTypes];
const uid = 'api::product.product';
const models = Object.fromEntries(publicNames.map(name => [
  `api::${name}.${name}`, { uid: `api::${name}.${name}`, ...require(path.join(output, `src/api/${name}/content-types/${name}/schema.json`)) }
]));
const contentTypes = require(path.join(i18n, 'services/content-types.js'))({ strapi: {} });
const base = {
  isLoaded: false, plugins: { 'content-manager': {}, i18n: {} }, contentTypes: models, components: {},
  getModel: model => models[model], service: name => ({ 'admin::permission': permission, 'admin::role': require(path.join(admin, 'server/src/services/role.js')) }[name]),
  plugin: name => ({ service: kind => name === 'i18n'
    ? { locales: { find: async () => [{ code: 'en' }, { code: 'ar' }, { code: 'zh-Hans' }], getDefaultLocale: async () => 'en' }, 'content-types': contentTypes }[kind]
    : { findAllContentTypes: () => Object.values(models).map(model => ({ ...model, isDisplayed: true })) } }),
  db: { query: () => ({ findMany: async () => [], findOne: async () => null }) }, log: { debug() {} }
};
globalThis.strapi = base;
require(path.join(i18n, 'services/permissions/actions.js')).updateActionsProperties();
await require(path.join(cm, 'services/permission.js'))({ strapi: base }).registerPermissions();
require(path.join(i18n, 'services/permissions/engine.js')).registerI18nPermissionsHandlers();

async function ability(changes = {}, model = uid) {
  const grants = ['read', 'create', 'update', 'publish'].map(action => ({
    action: `plugin::content-manager.explorer.${action}`, subject: model,
    properties: { locales: ['en', 'ar'], ...(['read', 'create', 'update'].includes(action) ? { fields: Object.keys(models[model].attributes) } : {}), ...(changes[action] || {}) },
    conditions: []
  }));
  return permission.engine.generateTokenAbility(grants, { id: 123, roles: [{ code: 'modular-operations' }] });
}

async function publishFixture(t, config, options = {}) {
  const uid = options.uid || 'api::product.product';
  const manager = createMiddlewareManager();
  const userAbility = options.userAbility || await ability({}, uid);
  const records = { en: { documentId: 'same-document', locale: 'en', title: 'Folding home', summary: 'A compact home', category: 'Residential', detail: null, customizableOptions: ['Layout', 2], slug: 'folding-home', sortOrder: 3, image: { id: 7 }, updatedAt: 'v1', createdBy: { id: 123 }, ...options.data } };
  if (options.existing) records['ar'] = { ...records.en, locale: 'ar', title: 'ترجمة سابقة' };
  const published = { en: { title: 'Old online version' }, 'ar': { title: 'النسخة المنشورة السابقة' } };
  const updates = [], publishes = [];
  const repository = manager.wrapObject({
    findOne: async ({ locale }) => structuredClone(records[locale] ?? null),
    update: async ({ locale, documentId, data }) => {
      updates.push({ locale, documentId, data: structuredClone(data) });
      records[locale] = { image: records.en.image, coverImage: records.en.coverImage, sortOrder: records.en.sortOrder, ...records[locale], ...structuredClone(data), documentId, locale,
        createdBy: { id: data.createdBy ?? records[locale]?.createdBy?.id ?? records.en.createdBy.id }, updatedBy: { id: data.updatedBy } };
      return structuredClone(records[locale]);
    },
    publish: async ({ locale, documentId }) => {
      publishes.push(locale);
      if (options.failPublish === locale) throw new Error('Database publish failed');
      const scalarData = Object.fromEntries(Object.entries(records[locale]).filter(([name]) => models[uid].attributes[name]?.type !== 'media'));
      await entityValidator.validateEntityCreation(models[uid], scalarData, { isDraft: false, locale });
      published[locale] = structuredClone(records[locale]);
      return { documentId, entries: [structuredClone(published[locale])] };
    }
  }, { uid, contentType: models[uid] });
  const documents = model => { assert.equal(model, uid); return repository; };
  documents.use = manager.use;
  const checker = require(path.join(cm, 'services/permission-checker.js')).default({ strapi: base });
  const strapi = {
    ...base, documents,
    config: { get: (key, fallback) => key === 'auto-translate' ? config : key === 'auto-translate.enabled' ? config.enabled : fallback },
    requestContext: { get: () => ({ state: options.anonymous ? {} : { user: { id: 123 }, userAbility } }) },
    plugin: name => name === 'content-manager' ? { service: kind => { assert.equal(kind, 'permission-checker'); return checker; } } : name === 'i18n' && options.locales ? { service: kind => kind === 'locales' ? { ...base.plugin(name).service(kind), find: async () => options.locales.map(code => ({ code })) } : base.plugin(name).service(kind) } : base.plugin(name),
    db: { transaction: async work => {
      const before = structuredClone({ records, published });
      try { return await work({}); } catch (error) {
        for (const table of [records, published]) for (const key of Object.keys(table)) delete table[key];
        Object.assign(records, before.records); Object.assign(published, before.published);
        throw error;
      }
    } }
  };
  require(path.join(output, 'src/lib/auto-translation.js')).registerAutoTranslation(strapi);
  return { strapi, records, published, updates, publishes };
}

test('native middleware publishes translated locales on the same document without recursion or shared field changes', async t => {
  const { config, requests } = await apiFixture(t, res => completion(res, ['منزل قابل للطي', 'منزل مدمج', 'سكني', 'التخطيط']));
  const fixture = await publishFixture(t, config);
  const result = await fixture.strapi.documents(uid).publish({ documentId: 'same-document', locale: 'en' });
  assert.equal(result.entries[0].locale, 'en');
  assert.equal(fixture.published['ar'].title, 'منزل قابل للطي');
  assert.equal(fixture.published['ar'].documentId, 'same-document');
  assert.equal(fixture.published['ar'].slug, 'folding-home');
  assert.equal(fixture.published['ar'].image.id, 7);
  assert.equal(fixture.published['ar'].sortOrder, 3);
  assert.deepEqual(fixture.updates[0].data, { title: 'منزل قابل للطي', summary: 'منزل مدمج', category: 'سكني', detail: null, customizableOptions: ['التخطيط', 2], productFaqs: null, slug: 'folding-home', createdBy: 123, updatedBy: 123 });
  assert.deepEqual(fixture.publishes.sort(), ['ar', 'en']);
  assert.equal(requests.length, 1, 'target publication must not translate back recursively');
  assert.ok(!JSON.stringify(requests[0].body).includes('createdBy'));
  assert.ok(!JSON.stringify(requests[0].body).includes('folding-home'));
});

test('product FAQ question and answer translate together while their JSON keys and source stay intact', async t => {
  const { config } = await apiFixture(t, res => completion(res, ['منزل قابل للطي', 'منزل مدمج', 'سكني', 'التخطيط', 'موعد التسليم؟', 'بعد تأكيد المشروع.']));
  const sourceFaqs = [{ question: 'Delivery?', answer: 'After project confirmation.' }];
  const fixture = await publishFixture(t, config, { data: { productFaqs: sourceFaqs } });
  await fixture.strapi.documents(uid).publish({ documentId: 'same-document', locale: 'en' });
  assert.deepEqual(fixture.published.ar.productFaqs, [{ question: 'موعد التسليم؟', answer: 'بعد تأكيد المشروع.' }]);
  assert.deepEqual(fixture.published.en.productFaqs, sourceFaqs);
});

test('updates an existing translation and supports either language as source', async t => {
  const { config, requests } = await apiFixture(t, res => completion(res, ['Folding home', 'Compact home', 'Residential', 'Layout']));
  const fixture = await publishFixture(t, config, { existing: true });
  await fixture.strapi.documents(uid).publish({ documentId: 'same-document', locale: 'ar' });
  assert.equal(fixture.published.en.summary, 'Compact home');
  assert.equal(fixture.published['ar'].title, 'ترجمة سابقة');
  assert.equal(JSON.parse(requests[0].body.messages.at(-1).content).targetLocale, 'en');
});

test('project parameters, features and FAQ translate without changing JSON keys, identity or media', async t => {
  const { config, requests } = await apiFixture(t, (res, request) => {
    const input = JSON.parse(request.body.messages.at(-1).content);
    completion(res, input.texts.map(item => `ترجمة ${item.text}`));
  });
  const model = 'api::project-case.project-case';
  const source = { projectFacts: [{ label: 'Area', value: '100 m²' }], features: ['Adaptable layout'], projectFaqs: [{ question: 'Delivery?', answer: 'Confirm the destination.' }], productionText: 'Plan, assemble, inspect.', productionSteps: ['Assembly'], shippingText: 'Packed for transport.' };
  const fixture = await publishFixture(t, config, { uid: model, data: source });
  await fixture.strapi.documents(model).publish({ documentId: 'same-document', locale: 'en' });
  assert.deepEqual(fixture.published.ar.projectFacts, [{ label: 'ترجمة Area', value: 'ترجمة 100 m²' }]);
  assert.deepEqual(fixture.published.ar.features, ['ترجمة Adaptable layout']);
  assert.deepEqual(fixture.published.ar.projectFaqs, [{ question: 'ترجمة Delivery?', answer: 'ترجمة Confirm the destination.' }]);
  assert.equal(fixture.published.ar.productionText, 'ترجمة Plan, assemble, inspect.');
  assert.deepEqual(fixture.published.ar.productionSteps, ['ترجمة Assembly']);
  assert.equal(fixture.published.ar.shippingText, 'ترجمة Packed for transport.');
  assert.equal(fixture.published.ar.slug, 'folding-home');
  assert.equal(fixture.published.ar.image.id, 7);
  assert.deepEqual(fixture.published.en.projectFacts, source.projectFacts);
  assert.equal(requests.length, 1);
});

for (const name of applicationTypes) test(`${name} supports the existing translated publication workflow with Markdown and shared cover`, async t => {
  const { config, requests } = await apiFixture(t, res => completion(res, ['تطبيق', 'ملخص', '## الحل\n\n**التصميم**']));
  const model = `api::${name}.${name}`;
  const fixture = await publishFixture(t, config, { uid: model, data: { body: '## Solution\n\n**Design**', coverImage: { id: 8 } } });
  await fixture.strapi.documents(model).publish({ documentId: 'same-document', locale: 'en' });
  assert.equal(fixture.published.ar.body, '## الحل\n\n**التصميم**');
  assert.equal(fixture.published.en.body, '## Solution\n\n**Design**');
  assert.equal(fixture.published.ar.coverImage.id, 8);
  const texts = JSON.parse(requests[0].body.messages.at(-1).content).texts.map(item => item.text);
  assert.deepEqual(texts, ['Folding home', 'A compact home', '## Solution\n\n**Design**']);
  assert.equal(requests.length, 1);
});

test('publishes configured French and Arabic translations on the same document without targeting archived Chinese', async t => {
  const { config, requests } = await apiFixture(t, (res, request) => {
    const locale = JSON.parse(request.body.messages.at(-1).content).targetLocale;
    completion(res, locale === 'fr' ? ['Maison pliable', 'Une maison compacte', 'Résidentiel', 'Agencement'] : ['منزل قابل للطي', 'منزل مدمج', 'سكني', 'التخطيط']);
  });
  const userAbility = await ability(Object.fromEntries(['read', 'create', 'update', 'publish'].map(action => [action, { locales: ['en', 'ar', 'fr'] }])));
  const fixture = await publishFixture(t, config, { userAbility, locales: ['en', 'ar', 'fr', 'zh-Hans'] });
  await fixture.strapi.documents(uid).publish({ documentId: 'same-document', locale: 'en' });
  assert.equal(fixture.published.fr.title, 'Maison pliable');
  assert.equal(fixture.published.fr.documentId, 'same-document');
  assert.equal(fixture.published.fr.slug, 'folding-home');
  assert.equal(fixture.published.fr.image.id, 7);
  assert.deepEqual(fixture.publishes.sort(), ['ar', 'en', 'fr']);
  assert.equal(requests.length, 2);
});

for (const changes of [{ enabled: false }, { anonymous: true }]) {
  test(`keeps ordinary publish behavior when ${changes.anonymous ? 'there is no admin context' : 'disabled'}`, async t => {
    const { config, requests } = await apiFixture(t, res => completion(res, []));
    const fixture = await publishFixture(t, { ...config, enabled: changes.enabled ?? true }, changes);
    await fixture.strapi.documents(uid).publish({ documentId: 'same-document', locale: 'en' });
    assert.equal(requests.length, 0);
    assert.deepEqual(fixture.publishes, ['en']);
    assert.equal(fixture.published['ar'].title, 'النسخة المنشورة السابقة');
  });
}

for (const [name, changes, existing] of [
  ['target publishing', { publish: { locales: ['en'] } }, false],
  ['target creation', { create: { locales: ['en'] } }, false],
  ['target editing', { update: { locales: ['en'] } }, true],
  ['source read fields', { read: { fields: ['title'] } }, false],
  ['target write fields', { create: { fields: ['title'] } }, false]
]) {
  test(`native Strapi permission engine rejects insufficient ${name} before translation`, async t => {
    const { config, requests } = await apiFixture(t, res => completion(res, []));
    const fixture = await publishFixture(t, config, { userAbility: await ability(changes), existing });
    await assert.rejects(fixture.strapi.documents(uid).publish({ documentId: 'same-document', locale: 'en' }), /权限/);
    assert.equal(requests.length, 0);
    assert.equal(fixture.updates.length, 0);
    assert.equal(fixture.published.en.title, 'Old online version');
  });
}

for (const failure of ['translation', 'target publication']) {
  test(`${failure} failure rolls back all language publications`, async t => {
    const { config } = await apiFixture(t, res => completion(res, failure === 'translation' ? [] : ['منزل قابل للطي', 'منزل مدمج', 'سكني', 'التخطيط']));
    const fixture = await publishFixture(t, config, { failPublish: failure === 'target publication' ? 'ar' : undefined });
    await assert.rejects(fixture.strapi.documents(uid).publish({ documentId: 'same-document', locale: 'en' }));
    assert.equal(fixture.published.en.title, 'Old online version');
    assert.equal(fixture.published['ar'].title, 'النسخة المنشورة السابقة');
    assert.equal(fixture.records['ar'], undefined);
  });
}

test('does not overwrite a target draft changed during the translation request', async t => {
  let fixture;
  const { config } = await apiFixture(t, res => {
    fixture.records['ar'].updatedAt = 'concurrent-edit';
    fixture.records['ar'].title = 'ترجمة معدلة';
    completion(res, ['منزل قابل للطي', 'منزل مدمج', 'سكني', 'التخطيط']);
  });
  fixture = await publishFixture(t, config, { existing: true });
  await assert.rejects(fixture.strapi.documents(uid).publish({ documentId: 'same-document', locale: 'en' }), /修改/);
  assert.equal(fixture.updates.length, 0);
  assert.equal(fixture.publishes.length, 0);
});

test('enabled feature with missing credentials cancels publication with a configuration message', async t => {
  const { config, requests } = await apiFixture(t, res => completion(res, []));
  const fixture = await publishFixture(t, { ...config, apiKey: '' });
  await assert.rejects(fixture.strapi.documents(uid).publish({ documentId: 'same-document', locale: 'en' }), /配置/);
  assert.equal(requests.length, 0);
  assert.equal(fixture.published.en.title, 'Old online version');
});

test('existing target UID is preserved independently of the translated text', async t => {
  const { config } = await apiFixture(t, res => completion(res, ['منزل قابل للطي', 'منزل مدمج', 'سكني', 'التخطيط']));
  const fixture = await publishFixture(t, config, { existing: true });
  fixture.records['ar'].slug = 'existing-arabic-slug';
  await fixture.strapi.documents(uid).publish({ documentId: 'same-document', locale: 'en' });
  assert.equal(fixture.published['ar'].slug, 'existing-arabic-slug');
  assert.equal(fixture.updates[0].data.slug, undefined);
});
