import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";

const require = createRequire(import.meta.url);
const cms = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(cms, ".cache", `content-tests-${process.pid}`);
execFileSync(process.execPath, [require.resolve("typescript/bin/tsc"), "--project", path.join(cms, "tsconfig.json"), "--outDir", output], { stdio: "pipe" });
after(() => rmSync(output, { recursive: true, force: true }));

const core = path.dirname(require.resolve("@strapi/core"));
const loadAPIs = require(path.join(core, "loaders/apis.js"));
const { createContentType } = require(path.join(core, "domain/content-type/index.js"));
// The real content-type factory reads the application feature configuration.
globalThis.strapi = { config: { get: () => false }, log: { warn() {} } };
const apis = {};
await loadAPIs({ dirs: { dist: { api: path.join(output, "src/api") } }, get: () => ({ add: (name, api) => { apis[name] = api; } }) });

const { applicationTypes } = require(path.join(output, "src/lib/application-pages.js"));
const { documentLibraryTypes } = require(path.join(output, "src/lib/document-libraries.js"));
const publicTypes = ["product", "project-case", "article", "certificate", "faq", "site-setting", ...applicationTypes, ...documentLibraryTypes];
const localizedFields = {
  ...Object.fromEntries(documentLibraryTypes.map(name => [name, ["title", "summary", "documents"]])),
  ...Object.fromEntries(applicationTypes.map(name => [name, ["title", "summary", "body"]])),
  product: ["title", "summary", "category", "detail", "customizableOptions"],
  "project-case": ["title", "location", "application", "summary", "detail"],
  article: ["title", "summary", "body"],
  certificate: ["title", "description", "issuer"],
  faq: ["question", "answer"],
  "site-setting": ["siteName", "footerNote"]
};

test('product taxonomy keys are shared across translations and returned only by published public readers', async () => {
  const taxonomy = require('@modular/contracts/product-taxonomy.json');
  const model = createContentType('api::product.product', apis.product.contentTypes.product);
  assert.equal(model.attributes.categoryKey.type, "string", "Business categories are no longer constrained to a schema enum");
  assert.notEqual(model.attributes.categoryKey.pluginOptions?.i18n?.localized, true);
  assert.equal(model.attributes.categoryKey.required, undefined, 'Existing product documents remain valid');
  const strapi = fixtureStrapi([{ documentId: 'published-product', slug: 'unit', title: 'Unit', category: 'Custom label', categoryKey: 'power-transformers' }]);
  const result = await apis.product.controllers.product({ strapi }).find(context());
  assert.equal(result.data[0].categoryKey, 'power-transformers');
  assert.ok(strapi.calls[0][2].fields.includes('categoryKey'));
  assert.equal(strapi.calls[0][2].status, 'published');
  const homepage = await apis['site-setting'].controllers['site-setting']({ strapi }).homepage(context());
  assert.equal(homepage.products[0].categoryKey, 'power-transformers');
});

for (const name of publicTypes) {
  test(`Strapi loads and validates the publishable localized ${name} model`, () => {
    assert.ok(apis[name]?.contentTypes[name], `Missing ${name} content type in compiled Strapi API`);
    const model = createContentType(`api::${name}.${name}`, apis[name].contentTypes[name]);
    assert.equal(model.options.draftAndPublish, true);
    assert.equal(model.pluginOptions.i18n.localized, true);
    if (documentLibraryTypes.includes(name)) {
      assert.equal(model.kind, "singleType");
      assert.equal(model.attributes.documents.component, "documents.download");
      assert.equal(model.attributes.documents.repeatable, true);
    }
    if (applicationTypes.includes(name)) {
      assert.equal(model.kind, "singleType");
      assert.equal(model.attributes.body.type, "richtext", "Use Strapi's Markdown editor");
      assert.equal(model.attributes.body.required, true);
      assert.equal(model.attributes.coverImage.type, "media");
    }
    for (const field of localizedFields[name]) assert.equal(model.attributes[field]?.pluginOptions?.i18n?.localized, true, `${name}.${field} is not localized`);
    if (["product", "project-case", "article", "certificate"].includes(name)) {
      assert.equal(model.attributes.slug?.unique, true);
      assert.equal(model.attributes.slug?.type, "uid");
    }
    if (name === "project-case") {
      assert.notEqual(model.attributes.slug.required, true, "Existing cases must remain editable without a slug");
      assert.equal(model.attributes.detail.type, "richtext");
      assert.equal(model.attributes.image.type, "media");
      assert.equal(model.attributes.gallery.multiple, true);
    }
  });
}

test("Strapi supplies inquiry timestamps while inquiry stays private and unlocalized", () => {
  const model = createContentType("api::inquiry.inquiry", apis.inquiry.contentTypes.inquiry);
  assert.equal(model.options.draftAndPublish, false);
  assert.notEqual(model.pluginOptions?.i18n?.localized, true);
  assert.equal(model.attributes.internalNotes.private, true);
  assert.equal(model.attributes.createdAt.type, "datetime");
  assert.deepEqual(model.attributes.followUpStatus.enum, ["new", "qualified", "quoted", "won", "lost"]);
  assert.deepEqual(Object.values(apis.inquiry.routes).flatMap(router => router.routes).filter(route => route.path.startsWith("/inquiries" )).map(route => [route.method, route.path]), [["POST", "/inquiries/submit"]]);
});

function consumedRoutes(name) {
  return Object.values(apis[name]?.routes ?? {}).flatMap(router => typeof router === "function" ? router({ strapi: {} }).routes : router.routes);
}

for (const [name, routePath] of [["product-category", "product-categories"], ["product", "products"], ["project-case", "project-cases"], ["article", "articles"], ["certificate", "certificates"], ["faq", "faqs"], ["site-setting", "site-setting"], ...[...applicationTypes, ...documentLibraryTypes].map(name => [name, name])]) {
  test(`${routePath} exposes only anonymous GET reads with resolvable controllers`, () => {
    const routes = consumedRoutes(name).filter(route => route.path !== "/homepage" && route.path !== "/project-cases/slug/:slug");
    assert.deepEqual(routes.map(route => [route.method, route.path]), apis[name].contentTypes[name].schema.kind === "singleType" ? [["GET", `/${routePath}`]] : [["GET", `/${routePath}`], ["GET", `/${routePath}/:documentId`]]);
    for (const route of routes) {
      assert.equal(route.config.auth, false);
      const action = route.handler.split(".").at(-1);
      const controllerFactory = apis[name].controllers[name];
      assert.equal(typeof controllerFactory({ strapi: fixtureStrapi() })[action], "function");
    }
  });
}

function context(query = {}, params = {}) {
  return { query, params, state: {}, badRequest(message) { this.status = 400; this.body = { error: { message } }; }, notFound() { this.status = 404; this.body = { error: { message: "Not Found" } }; } };
}

function fixtureStrapi(records = [{ documentId: "published-product", slug: "module", title: "Published module", category: "Residential", summary: "Public summary", detail: "Public detail", publishedAt: "2026-10-09T00:00:00.000Z", customizableOptions: ["Layout"], image: { url: "/module.png", name: "module.png", provider_metadata: { secret: "private-storage-id" } }, createdBy: { email: "admin@example.invalid" } }]) {
  const calls = [];
  const strapi = {
    calls,
    contentType(uid) { const name = uid.split(".").at(-1); return createContentType(uid, apis[name].contentTypes[name]); },
    documents(uid) {
      const content = uid === "api::faq.faq" ? [{ documentId: "faq-document", question: "Can layouts change?", answer: "Yes, share the requirements.", publishedAt: "2026-10-09T00:00:00.000Z" }] : uid === "api::site-setting.site-setting" ? [{ documentId: "settings-document", siteName: "Demo Site", contactEmail: "contact@example.invalid", footerNote: "Demo footer", publishedAt: "2026-10-09T00:00:00.000Z" }] : records;
      return {
        async findMany(query) { calls.push([uid, "findMany", query]); return query.status === "published" ? content : [{ documentId: "draft-document", title: "DRAFT" }]; },
        async count(query) { calls.push([uid, "count", query]); return 3; },
        async findOne(query) { calls.push([uid, "findOne", query]); return query.status === "published" && query.documentId === "published-product" ? records[0] : null; },
        async findFirst(query) { calls.push([uid, "findFirst", query]); return query.status === "published" ? content[0] ?? null : null; }
      };
    }
  };
  return strapi;
}

test('category public reads expose published multilingual names and stable identity without editor data', async () => {
  const model = createContentType('api::product-category.product-category', apis['product-category'].contentTypes['product-category']);
  assert.notEqual(model.pluginOptions?.i18n?.localized, true);
  const strapi = fixtureStrapi([{ documentId: 'garden', key: 'garden-rooms', slug: 'garden-rooms', nameEn: 'Garden Rooms', nameFr: 'Studios', nameAr: 'غرف', nameZh: '花园房', division: 'modular-buildings', group: 'none', sortOrder: 0, visible: false, createdBy: { email: 'private@example.invalid' } }]);
  const result = await apis['product-category'].controllers['product-category']({ strapi }).find(context({ status: 'draft' }));
  assert.equal(strapi.calls[0][2].status, 'published');
  assert.equal(result.data[0].key, 'garden-rooms');
  assert.equal(result.data[0].visible, false, 'hidden categories retain working direct URLs');
  assert.equal(result.data[0].nameAr, 'غرف');
  assert.equal(result.data[0].createdBy, undefined);
});

for (const name of publicTypes) {
  test(`${name} public reader pins published status and passes bounded locale/pagination to documents`, async () => {
    assert.ok(apis[name]?.controllers[name], `Missing ${name} public controller`);
    const strapi = fixtureStrapi();
    const controller = apis[name].controllers[name]({ strapi });
    const ctx = context({ locale: "zh-Hans", status: "draft", publicationState: "preview", pagination: { page: "2", pageSize: "1000" }, populate: "*", filters: { publishedAt: { $null: true } } });
    const response = await controller.find(ctx);
    assert.equal(strapi.calls[0][2].status, "published");
    assert.equal(strapi.calls[0][2].locale, "zh-Hans");
    assert.equal(strapi.calls[0][2].filters, undefined);
    assert.notEqual(strapi.calls[0][2].populate, "*");
    if (apis[name].contentTypes[name].schema.kind !== "singleType") {
      assert.equal(strapi.calls[0][2].limit, 100);
      assert.equal(strapi.calls[0][2].start, 100);
      assert.deepEqual(response.meta.pagination, { page: 2, pageSize: 100, pageCount: 1, total: 3 });
    }
    assert.equal(JSON.stringify(response).includes("admin@example.invalid"), false);
    assert.equal(JSON.stringify(response).includes("private-storage-id"), false);
    assert.equal(JSON.stringify(response).includes("DRAFT"), false);
  });
}

test("document libraries publish only approved component fields and media, isolated by category and locale", async () => {
  const calls = [];
  const strapi = { documents(uid) { return { async findFirst(query) {
    calls.push({ uid, query });
    if (query.locale === "fr") return null;
    return { title: uid, locale: query.locale, publishedAt: "2026-11-02", documents: [{ id: 7, title: "Specification", description: "Approved document", internalNotes: "private", file: { name: "spec.pdf", url: "/uploads/spec.pdf", mime: "application/pdf", size: 12, provider_metadata: { secret: "private" } } }], internalNotes: "private" };
  } }; } };
  for (const name of documentLibraryTypes) {
    const controller = apis[name].controllers[name]({ strapi });
    const response = await controller.find(context({ locale: "en", status: "draft", populate: "*", fields: ["internalNotes"] }));
    assert.equal(response.data.title, `api::${name}.${name}`);
    assert.deepEqual(response.data.documents, [{ id: 7, title: "Specification", description: "Approved document", file: { name: "spec.pdf", url: "/uploads/spec.pdf", mime: "application/pdf", size: 12 } }]);
    assert.equal(JSON.stringify(response).includes("private"), false);
    const { query } = calls.at(-1);
    assert.equal(query.status, "published");
    assert.equal(query.locale, "en");
    assert.deepEqual(query.populate.documents.fields, ["id", "title", "description"]);
    assert.ok(query.populate.documents.populate.file.fields.includes("url"));
    assert.equal((await controller.find(context({ locale: "fr" }))).data, null);
  }
  const component = require(path.join(output, "src/components/documents/download.json"));
  assert.equal(component.attributes.title.required, true);
  assert.equal(component.attributes.file.required, true);
  assert.equal(component.attributes.file.multiple, false);
});

test("product details use documentId and never return an unpublished or missing document", async () => {
  assert.ok(apis.product.controllers.product, "Missing product public controller");
  const strapi = fixtureStrapi();
  const controller = apis.product.controllers.product({ strapi });
  const result = await controller.findOne(context({ locale: "en", status: "draft" }, { documentId: "published-product" }));
  assert.equal(result.data.slug, "module");
  assert.deepEqual(strapi.calls[0][2].documentId, "published-product");
  assert.equal(strapi.calls[0][2].status, "published");
  const missing = context({}, { documentId: "draft-only" });
  await controller.findOne(missing);
  assert.equal(missing.status, 404);
});

test("product FAQ exposes only complete question/answer pairs from published product JSON", async () => {
  const strapi = fixtureStrapi([{ documentId: "published-product", slug: "faq-product", productFaqs: [
    { question: " Delivery? ", answer: " Share your destination. ", internalNotes: "private" },
    { question: "Incomplete", answer: " " }, null, "invalid", { question: 42, answer: "invalid" }
  ] }]);
  const response = await apis.product.controllers.product({ strapi }).find(context({ status: "draft" }));
  assert.deepEqual(response.data[0].productFaqs, [{ question: "Delivery?", answer: "Share your destination." }]);
  assert.equal(strapi.calls[0][2].status, "published");
  assert.ok(strapi.calls[0][2].fields.includes("productFaqs"));
});

test("application Single Types isolate their published Markdown and locales, including empty unpublished pages", async () => {
  const calls = [];
  const strapi = { documents(uid) { return { async findFirst(query) {
    calls.push({ uid, query });
    if (query.locale === "ar") return null;
    return { documentId: uid, locale: query.locale, title: uid, summary: "Summary", body: `## ${uid}`, publishedAt: "2026-11-02T00:00:00Z", coverImage: { url: "/uploads/cover.jpg", alternativeText: "Cover", provider_metadata: { secret: "private" } }, internalNotes: "private", createdBy: { email: "private" } };
  } }; } };
  for (const name of applicationTypes) {
    const controller = apis[name].controllers[name]({ strapi });
    for (const locale of ["en", "fr", "ar"]) {
      const response = await controller.find(context({ locale, status: "draft", populate: "*", fields: ["internalNotes"] }));
      if (locale === "ar") assert.equal(response.data, null);
      else {
        assert.equal(response.data.title, `api::${name}.${name}`);
        assert.equal(response.data.body, `## api::${name}.${name}`);
        assert.equal(response.data.locale, locale);
        assert.equal(JSON.stringify(response).includes("private"), false);
      }
      const { uid, query } = calls.at(-1);
      assert.equal(uid, `api::${name}.${name}`);
      assert.equal(query.status, "published");
      assert.equal(query.locale, locale);
      assert.equal(query.fields.includes("internalNotes"), false);
    }
    const count = calls.length;
    const invalid = context({ locale: ["en", "fr"] });
    await controller.find(invalid);
    assert.equal(invalid.status, 400);
    assert.equal(calls.length, count);
  }
});

test("public readers reject unsafe locale and malformed pagination before database access", async () => {
  assert.ok(apis.product.controllers.product, "Missing product public controller");
  const strapi = fixtureStrapi();
  const controller = apis.product.controllers.product({ strapi });
  for (const query of [{ locale: "all" }, { locale: ["en", "zh"] }, { locale: { $ne: "en" } }, { locale: "en;DROP" }, { pagination: { page: "0" } }, { pagination: { pageSize: "-2" } }, { pagination: { page: "1.5" } }]) {
    const ctx = context(query);
    await controller.find(ctx);
    assert.equal(ctx.status, 400, JSON.stringify(query));
  }
  assert.equal(strapi.calls.length, 0);
});

test("homepage keeps product/FAQ/settings and adds published cases/documents with a validated locale", async () => {
  const strapi = fixtureStrapi();
  const controller = apis["site-setting"].controllers["site-setting"]({ strapi });
  const response = await controller.homepage(context({ locale: "en", status: "draft" }));
  assert.deepEqual(Object.keys(response), ["products", "faqs", "settings", "cases", "certificates"]);
  assert.equal(response.products[0].slug, "module");
  assert.equal(response.products[0].imageUrl, "/module.png");
  assert.equal(response.products[0].eyebrow, "01 / RESIDENTIAL");
  assert.equal(response.products[0].category, "Residential");
  assert.deepEqual(response.products[0].options, ["Layout"]);
  assert.deepEqual(response.faqs, [["Can layouts change?", "Yes, share the requirements."]]);
  assert.deepEqual(response.settings, { siteName: "Demo Site", contactEmail: "contact@example.invalid", footerNote: "Demo footer" });
  assert.ok(strapi.calls.every(([, , query]) => query.status === "published" && query.locale === "en"));
  const unsafe = context({ locale: "all" });
  await controller.homepage(unsafe);
  assert.equal(unsafe.status, 400);
  assert.equal(strapi.calls.length, 5);
  assert.deepEqual(response.cases, []);
  assert.deepEqual(response.certificates, []);
});

test("homepage projects only verified published cases, approved company fields and certificate media", async () => {
  const calls = [];
  const strapi = { documents(uid) { return {
    async findMany(query) {
      calls.push([uid, query]);
      if (uid === "api::project-case.project-case") return [
        { title: "Verified project", location: "UK", productName: "Office", quantity: "12 units", summary: "Delivered", publishedAt: "2026-11-03T00:00:00.000Z", isVerified: true, image: { url: "/uploads/case.jpg", provider_metadata: { secret: "private" } }, internalNotes: "private" },
        { title: "Demo project", isVerified: false, imageUrl: "/demo.jpg" }
      ];
      if (uid === "api::certificate.certificate") return [
        { title: "Certificate PDF", document: { url: "/uploads/cert.pdf", mime: "application/pdf" }, internalNotes: "private" },
        { title: "Certificate image", document: { url: "/uploads/cert.png", mime: "image/png" } },
        { title: "No document" }
      ];
      return [];
    },
    async findFirst(query) {
      calls.push([uid, query]);
      return { siteName: "ZHUDUO", foundedYear: 2010, factoryArea: 6000, whatsappNumber: "+441234567890", companyIntro: "Published intro", factoryImage: { url: "/uploads/factory.jpg", provider_metadata: { secret: "private" } }, contactEmail: "sales@example.org", footerNote: "Footer", internalNotes: "private" };
    }
  }; } };
  const response = await apis["site-setting"].controllers["site-setting"]({ strapi }).homepage(context({ locale: "fr", status: "draft", populate: "*" }));
  assert.ok(calls.every(([, query]) => query.status === "published" && query.locale === "fr"));
  const caseQuery = calls.find(([uid]) => uid === "api::project-case.project-case")[1];
  assert.deepEqual(caseQuery.filters, { isVerified: true });
  assert.equal(caseQuery.limit, 3);
  assert.ok(caseQuery.fields.includes("publishedAt"));
  assert.deepEqual(response.cases, [{ title: "Verified project", location: "UK", productName: "Office", quantity: "12 units", summary: "Delivered", imageUrl: "/uploads/case.jpg", publishedAt: "2026-11-03T00:00:00.000Z" }]);
  assert.deepEqual(response.certificates, [{ title: "Certificate PDF", url: "/uploads/cert.pdf" }, { title: "Certificate image", url: "/uploads/cert.png", imageUrl: "/uploads/cert.png" }]);
  assert.equal(response.settings.factoryImageUrl, "/uploads/factory.jpg");
  assert.equal(response.settings.foundedYear, 2010);
  assert.equal(JSON.stringify(response).includes("private"), false);
});

function envFrom(values = {}) {
  const env = (key, fallback) => values[key] ?? fallback;
  env.int = (key, fallback) => Number(env(key, fallback));
  env.bool = (key, fallback) => env(key, fallback) === true || env(key, fallback) === "true";
  env.array = env;
  return env;
}

test("database config supports URL and VM variables with an idle-safe pool", () => {
  const database = require(path.join(output, "config/database.js"));
  const url = database({ env: envFrom({ DATABASE_URL: "postgres://test:test@db.invalid:5432/test" }) });
  assert.equal(url.connection.client, "postgres");
  assert.equal(url.connection.connection.connectionString, "postgres://test:test@db.invalid:5432/test");
  assert.equal(url.connection.pool.min, 0);
  const { Client } = require("pg");
  const parameters = new Client(url.connection.connection).connectionParameters;
  assert.equal(parameters.host, "db.invalid");
  assert.equal(parameters.user, "test");
  assert.equal(parameters.database, "test");
  const vm = database({ env: envFrom({ DATABASE_HOST: "db", DATABASE_NAME: "housing", DATABASE_USERNAME: "cms", DATABASE_PASSWORD: "test-only" }) });
  assert.equal(vm.connection.connection.host, "db");
  assert.equal(vm.connection.connection.database, "housing");
  assert.equal(vm.connection.connection.user, "cms");
  assert.equal(vm.connection.connection.connectionString, undefined);
});

test("server config reaches Koa with one trusted proxy IP and disables remote transfer", () => {
  const config = require(path.join(output, "config/server.js"))({ env: envFrom() });
  const createKoaApp = require(path.join(core, "services/server/koa.js"));
  const app = createKoaApp({ proxy: config.proxy.koa, maxIpsCount: config.proxy.maxIpsCount, keys: config.app.keys });
  assert.equal(app.proxy, true);
  assert.equal(app.maxIpsCount, 1);
  assert.equal(config.transfer.remote.enabled, false);
});

test("Strapi's HTTP route composer serves published reads and rejects public writes", async () => {
  const { createAPI } = require(path.join(core, "services/server/api.js"));
  const createKoaApp = require(path.join(core, "services/server/koa.js"));
  const createAuthentication = require(path.join(core, "services/auth/index.js"));
  const createPolicies = require(path.join(core, "registries/policies.js"));
  const createControllers = require(path.join(core, "registries/controllers.js"));
  const { query } = require(path.join(core, "middlewares/query.js"));
  const Router = require("@koa/router");
  const strapi = fixtureStrapi();
  const auth = createAuthentication();
  const policies = createPolicies();
  const controllers = createControllers(strapi);
  for (const name of publicTypes) controllers.add(`api::${name}`, apis[name].controllers);
  strapi.controller = uid => controllers.get(uid);
  strapi.get = name => ({ auth, policies })[name];
  const api = createAPI(strapi, { type: "content-api", prefix: "/api" });
  for (const name of publicTypes) for (const router of Object.values(apis[name].routes)) api.routes(router);
  const router = new Router();
  api.mount(router);
  const app = createKoaApp({ keys: ["test-only"] });
  strapi.server = { app };
  query({}, { strapi });
  app.use(router.routes()).use(router.allowedMethods());
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const list = await fetch(`${origin}/api/products?locale=zh-Hans&status=draft&pagination[page]=2&pagination[pageSize]=2&populate=*`);
    assert.equal(list.status, 200);
    assert.deepEqual((await list.json()).meta.pagination, { page: 2, pageSize: 2, pageCount: 2, total: 3 });
    const detail = await fetch(`${origin}/api/products/published-product?status=draft`);
    assert.equal(detail.status, 200);
    assert.equal((await detail.json()).data.title, "Published module");
    const draft = await fetch(`${origin}/api/products/draft-only`);
    assert.equal(draft.status, 404);
    const invalid = await fetch(`${origin}/api/products?locale[]=en&locale[]=zh`);
    assert.equal(invalid.status, 400);
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      assert.equal((await fetch(`${origin}/api/products`, { method })).status, 405, method);
    }
    assert.equal((await fetch(`${origin}/api/inquiries`)).status, 404);
    for (const name of applicationTypes) {
      assert.equal((await fetch(`${origin}/api/${name}?locale=en&status=draft`)).status, 200);
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) assert.equal((await fetch(`${origin}/api/${name}`, { method })).status, 405);
      assert.equal((await fetch(`${origin}/api/${name}/arbitrary-document`)).status, 404);
    }
    assert.ok(strapi.calls.every(([, , query]) => query.status === "published"));
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});


test("project slug endpoint isolates publication, verification, locale and public field projection", async () => {
  let entity = { documentId: "verified-project", slug: "verified-project", locale: "en", publishedAt: "2026-11-03T00:00:00.000Z", isVerified: true, title: "Project", projectFacts: [{ label: "Area", value: "100 m²", internalNotes: "private" }, { label: "Missing", value: "" }], features: ["Good", null], projectFaqs: [{ question: "Q", answer: "A", token: "private" }], image: { url: "/uploads/image.jpg", provider_metadata: { secret: "private" } }, video: { url: "/uploads/movie.mp4", provider_metadata: { secret: "private" } }, internalNotes: "private", createdBy: { email: "private" } };
  const calls = [];
  const controller = apis["project-case"].controllers["project-case"]({ strapi: { documents: () => ({ async findFirst(query) { calls.push(query); return entity; } }) } });
  const ctx = () => ({ ...context({ locale: "en", status: "draft", filters: { isVerified: false }, populate: "*", fields: ["internalNotes"] }), params: { slug: "verified-project" } });
  const response = await controller.findBySlug(ctx());
  assert.equal(response.data.slug, "verified-project");
  assert.equal(JSON.stringify(response).includes("private"), false);
  assert.deepEqual(response.data.projectFacts, [{ label: "Area", value: "100 m²" }]);
  assert.deepEqual(response.data.projectFaqs, [{ question: "Q", answer: "A" }]);
  assert.deepEqual(response.data.features, ["Good"]);
  assert.equal(calls[0].status, "published");
  assert.equal(calls[0].locale, "en");
  assert.deepEqual(calls[0].filters, { slug: "verified-project", isVerified: true });
  assert.equal(calls[0].fields.includes("internalNotes"), false);
  const original = entity;
  for (const change of [{ publishedAt: null }, { isVerified: false }, { locale: "fr" }, { slug: "other" }]) {
    entity = { ...original, ...change }; const request = ctx(); await controller.findBySlug(request); assert.equal(request.status, 404);
  }
  entity = null; const missing = ctx(); await controller.findBySlug(missing); assert.equal(missing.status, 404);
  for (const query of [{ locale: "all" }, { locale: ["en", "fr"] }]) {
    const request = { ...ctx(), query }; const before = calls.length; await controller.findBySlug(request); assert.equal(request.status, 400); assert.equal(calls.length, before);
  }
  const unsupported = { ...ctx(), query: { locale: "zh-Hans" } }; await controller.findBySlug(unsupported); assert.equal(unsupported.status, 404);
  const routes = consumedRoutes("project-case").filter(route => route.path === "/project-cases/slug/:slug");
  assert.equal(routes.length, 1); assert.equal(routes[0].method, "GET"); assert.equal(routes[0].config.auth, false);
});
