import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const cms = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(cms, '.cache', `roles-tests-${process.pid}`);
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', path.join(cms, 'tsconfig.json'), '--outDir', output], { stdio: 'pipe' });
after(() => rmSync(output, { recursive: true, force: true }));
const admin = path.dirname(require.resolve('@strapi/admin/strapi-server'));
const adminLoad = file => require(path.join(admin, 'server/src', file));
const cm = path.dirname(require.resolve('@strapi/content-manager/strapi-server'));
const i18n = path.dirname(require.resolve('@strapi/i18n/strapi-server'));
const lifecycle = require(path.join(output, 'src/index.js')).default;
const { subject } = require('@casl/ability');
const { applicationTypes } = require(path.join(output, 'src/lib/application-pages.js'));
const { documentLibraryTypes } = require(path.join(output, 'src/lib/document-libraries.js'));
const names = ['product', 'product-category', 'project-case', 'article', 'certificate', 'faq', 'site-setting', 'inquiry', ...applicationTypes, ...documentLibraryTypes];
const models = Object.fromEntries(names.map(name => { const uid = `api::${name}.${name}`; return [uid, { uid, ...require(path.join(output, `src/api/${name}/content-types/${name}/schema.json`)) }]; }));
const components = { 'documents.download': { uid: 'documents.download', ...require(path.join(output, 'src/components/documents/download.json')) } };
const roles = [], grants = [];
let nextId = 1;
const roleService = adminLoad('services/role.js');
const permission = adminLoad('services/permission.js');
const services = {
  'admin::role': roleService, 'admin::permission': permission,
  'admin::metrics': adminLoad('services/metrics.js'),
  'admin::api-token-admin': { syncPermissionsForRole: adminLoad('services/api-token.js').syncApiTokenPermissionsForRole }
};
const localeService = { find: async () => [{ code: 'en' }, { code: 'zh-Hans' }] };
const i18nContentTypes = require(path.join(i18n, 'services/content-types.js'))({ strapi: {} });
const strapi = {
  store: () => ({ get: async () => true }),
  isLoaded: false, plugins: { 'content-manager': {}, upload: {}, i18n: {} }, contentTypes: models, components, getModel: uid => models[uid] || components[uid],
  service: uid => services[uid],
  plugin: name => ({ service: kind => name === 'i18n' ? ({ locales: localeService, 'content-types': i18nContentTypes }[kind]) : { findAllContentTypes: () => Object.values(models).map(model => ({ ...model, isDisplayed: true })) } }),
  eventHub: { emit() {} }, telemetry: { send() {} }, log: { debug() {} },
  db: { transaction: async work => work({}), query: uid => {
    const table = uid === 'admin::role' ? roles : uid === 'admin::permission' ? grants : [];
    const matches = (row, where = {}) => Object.entries(where).every(([key, value]) => key === 'role' ? row.role === value.id : row[key] === value);
    return {
      count: async ({ where = {} } = {}) => table.filter(row => matches(row, where)).length,
      findOne: async ({ where = {} }) => table.find(row => matches(row, where)) ?? null,
      findMany: async ({ where = {} } = {}) => table.filter(row => matches(row, where)),
      create: async ({ data }) => { const row = { id: nextId++, ...structuredClone(data) }; table.push(row); return row; },
      delete: async ({ where }) => { const at = table.findIndex(row => matches(row, where)); return at < 0 ? null : table.splice(at, 1)[0]; }
    };
  } }
};
globalThis.strapi = strapi;
const localeActions = require(path.join(i18n, 'services/permissions/actions.js'));
localeActions.updateActionsProperties();
await require(path.join(cm, 'services/permission.js'))({ strapi }).registerPermissions();
await permission.actionProvider.registerMany(['read', 'assets.create', 'assets.update', 'settings.read'].map(uid => ({ uid, pluginName: 'upload', section: 'plugins', displayName: uid })));
await permission.actionProvider.registerMany(adminLoad('config/admin-actions.js').actions);
require(path.join(i18n, 'services/permissions/engine.js')).registerI18nPermissionsHandlers();

test('bootstrap creates persisted admin roles once using real assignment and preserves manual permissions on reboot', async () => {
  await lifecycle.bootstrap({ strapi });
  assert.equal(roles.length, 2);
  assert.ok(roles.some(role => role.name === 'Operations'));
  assert.ok(roles.some(role => role.name === 'Sales'));
  const initialCount = grants.length;
  const sales = roles.find(role => role.name === 'Sales');
  const manual = grants.find(grant => grant.role === sales.id && grant.action.endsWith('.update'));
  manual.properties.fields = ['internalNotes'];
  await lifecycle.bootstrap({ strapi });
  assert.equal(roles.length, 2);
  assert.equal(grants.length, initialCount);
  assert.deepEqual(manual.properties.fields, ['internalNotes']);
  // Restore for the independent runtime boundary check.
  manual.properties.fields = ['followUpStatus', 'internalNotes'];
});

test('actual Strapi ability and Content Manager sanitizers enforce Operations/Sales fields, locales and media boundaries', async () => {
  assert.equal(roles.length, 2, 'bootstrap did not provision roles');
  const abilityFor = async name => {
    const role = roles.find(role => role.name === name);
    return permission.engine.generateTokenAbility(grants.filter(grant => grant.role === role.id), { id: 123, roles: [role] });
  };
  const operations = await abilityFor('Operations');
  const sales = await abilityFor('Sales');
  for (const field of ['nameEn', 'nameFr', 'nameAr', 'division', 'group', 'slug', 'sortOrder', 'visible']) assert.equal(operations.can('plugin::content-manager.explorer.update', 'api::product-category.product-category', field), true, field);
  assert.equal(operations.can('plugin::content-manager.explorer.update', 'api::product-category.product-category', 'key'), false, 'internal identity cannot be edited by business users');
  for (const name of documentLibraryTypes) for (const field of ['title', 'summary', 'documents.title', 'documents.description', 'documents.file']) {
    assert.equal(operations.can('plugin::content-manager.explorer.update', subject(`api::${name}.${name}`, { locale: 'en' }), field), true, `${name}.${field}`);
  }
  for (const name of applicationTypes) for (const field of ['title', 'summary', 'body', 'coverImage']) {
    assert.equal(operations.can('plugin::content-manager.explorer.update', subject(`api::${name}.${name}`, { locale: 'en' }), field), true, `${name}.${field}`);
  }
  for (const [name, fields] of [['site-setting', ['companyIntro', 'factoryImage', 'foundedYear', 'whatsappNumber']], ['product', ['featured', 'productFaqs']], ['project-case', ['productName', 'quantity', 'isVerified']]]) {
    for (const field of fields) assert.equal(operations.can('plugin::content-manager.explorer.update', subject(`api::${name}.${name}`, { locale: 'en' }), field), true, `${name}.${field}`);
  }
  for (const name of names.filter(name => name !== 'inquiry')) {
    for (const action of ['create', 'read', 'update', 'delete', 'publish']) {
      assert.equal(operations.can(`plugin::content-manager.explorer.${action}`, subject(`api::${name}.${name}`, { locale: 'zh-Hans' })), true, `${name} ${action}`);
      assert.equal(sales.can(`plugin::content-manager.explorer.${action}`, `api::${name}.${name}`), false);
    }
  }
  assert.equal(operations.can('plugin::content-manager.explorer.read', 'api::inquiry.inquiry'), false);
  assert.equal(sales.can('plugin::content-manager.explorer.read', 'api::inquiry.inquiry', 'whatsapp'), true);
  assert.equal(sales.can('plugin::content-manager.explorer.update', 'api::inquiry.inquiry', 'whatsapp'), false);
  for (const action of ['read', 'assets.create', 'assets.update']) { assert.equal(operations.can(`plugin::upload.${action}`), true); assert.equal(sales.can(`plugin::upload.${action}`), false); }
  for (const ability of [operations, sales]) {
    assert.equal(ability.can('admin::users.create'), false);
    assert.equal(ability.can('admin::project-settings.update'), false);
    assert.equal(ability.can('plugin::upload.settings.read'), false);
  }
  for (const action of ['create', 'delete', 'publish']) assert.equal(sales.can(`plugin::content-manager.explorer.${action}`, 'api::inquiry.inquiry'), false);
  const checker = require(path.join(cm, 'services/permission-checker.js')).default({ strapi }).create({ userAbility: sales, model: 'api::inquiry.inquiry' });
  const record = { id: 1, documentId: 'inq', name: 'Jamie', followUpStatus: 'new', internalNotes: 'private' };
  assert.deepEqual(await checker.sanitizeUpdateInput(record)({ name: 'injected', email: 'injected@example.com', followUpStatus: 'qualified', internalNotes: 'Called customer' }), { followUpStatus: 'qualified', internalNotes: 'Called customer' });
  assert.equal((await checker.sanitizeOutput(record)).internalNotes, 'private');
});

test('registered i18n settings write uses the real admin policy and keeps the super-admin action available', async () => {
  const routes = structuredClone(require(path.join(i18n, 'routes/admin.js')));
  const registering = { plugin: () => ({ routes: { admin: routes } }) };
  await lifecycle.register({ strapi: registering });
  await lifecycle.register({ strapi: registering });
  const route = routes.routes.find(route => route.method === 'PUT' && route.path === '/settings');
  const guard = route.config.policies.filter(policy => typeof policy === 'object' && policy.name === 'admin::hasPermissions');
  assert.equal(guard.length, 1);
  const policy = adminLoad('policies/hasPermissions.js');
  policy.validator(guard[0].config);
  const sales = roles.find(role => role.name === 'Sales');
  const denied = await permission.engine.generateTokenAbility(grants.filter(grant => grant.role === sales.id), { id: 123, roles: [sales] });
  assert.equal(policy.handler({ state: { userAbility: denied } }, guard[0].config), false);
  const superAdmin = await permission.engine.generateTokenAbility([{ action: 'admin::project-settings.update', properties: {}, conditions: [] }], { roles: [{ code: 'strapi-super-admin' }] });
  assert.equal(policy.handler({ state: { userAbility: superAdmin } }, guard[0].config), true);
});

test('Content Manager document metadata retains the sales follow-up field instead of overwriting reserved status', async () => {
  const metadata = require(path.join(cm, 'services/document-metadata.js'))({ strapi });
  metadata.getMetadata = async () => ({ versions: [], availableLocales: [], availableStatus: [] });
  const model = models['api::inquiry.inquiry'];
  assert.ok(model.attributes.followUpStatus);
  assert.equal(model.attributes.status, undefined);
  const result = await metadata.formatDocumentWithMetadata(model.uid, { documentId: 'inq', followUpStatus: 'qualified' });
  assert.equal(result.data.followUpStatus, 'qualified');
});
