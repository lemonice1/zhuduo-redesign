import { applicationFields, applicationMedia, applicationTypes } from "./application-pages";
import { documentLibraryFields, documentLibraryTypes } from "./document-libraries";
import { publicProductFaqs } from "./product-content";
import { productCategoryFields } from "./product-categories";
import { projectFields, projectMedia, publicProjectRows } from "./project-content";

type ContentDefinition = { fields: string[]; media?: string[]; single?: boolean; components?: Record<string, ContentDefinition> };
export const siteSettingFields = ["siteName", "contactEmail", "footerNote", "whatsappNumber", "companyAddress", "companyIntro", "foundedYear", "factoryArea", "exportMarkets", "certificationCount", "exhibitionName", "exhibitionDetails"];
export const siteSettingMedia = ["factoryImage", "heroHousingImage", "heroElectricalImage"];

const definitions: Record<string, ContentDefinition> = {
  "product-category": { fields: productCategoryFields },
  ...Object.fromEntries(documentLibraryTypes.map(name => [name, { fields: documentLibraryFields, single: true, components: { documents: { fields: ["id", "title", "description"], media: ["file"] } } }])),
  ...Object.fromEntries(applicationTypes.map(name => [name, { fields: applicationFields, media: applicationMedia, single: true }])),
  product: { fields: ["slug", "title", "summary", "category", "categoryKey", "detail", "customizableOptions", "productFaqs", "imageUrl", "sortOrder", "featured"], media: ["image", "gallery", "brochure"] },
  "project-case": { fields: projectFields, media: projectMedia },
  article: { fields: ["slug", "title", "summary", "body", "sortOrder"], media: ["coverImage"] },
  certificate: { fields: ["slug", "title", "description", "issuer", "sortOrder"], media: ["document"] },
  faq: { fields: ["question", "answer", "sortOrder"] },
  "site-setting": { fields: siteSettingFields, media: siteSettingMedia, single: true }
};

const mediaFields = ["documentId", "name", "alternativeText", "caption", "url", "width", "height", "mime", "ext", "size", "formats"];

export function readPublicLocale(query: any = {}): { locale?: string } {
  const value = query.locale;
  if (value === undefined) return {};
  if (typeof value !== "string" || value.length > 35 || value === "all" || !/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(value)) {
    throw new Error("locale must be a single locale code, such as en or zh-Hans.");
  }
  return { locale: value };
}

function readPagination(query: any = {}) {
  const pagination = query.pagination ?? {};
  if (typeof pagination !== "object" || Array.isArray(pagination)) throw new Error("pagination must contain page and pageSize.");
  const positiveInteger = (value: unknown, fallback: number) => {
    if (value === undefined) return fallback;
    if (!((typeof value === "string" && /^\d+$/.test(value)) || typeof value === "number") || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
      throw new Error("pagination values must be positive integers.");
    }
    return Number(value);
  };
  const page = positiveInteger(pagination.page, 1);
  const pageSize = Math.min(positiveInteger(pagination.pageSize, 25), 100);
  const start = (page - 1) * pageSize;
  if (!Number.isSafeInteger(start)) throw new Error("pagination page is too large.");
  return { page, pageSize, start };
}

function pick(entity: any, fields: string[]) {
  return Object.fromEntries(fields.filter(field => entity[field] !== undefined).map(field => [field, entity[field]]));
}

function publicMedia(media: any): any {
  if (Array.isArray(media)) return media.map(publicMedia);
  if (!media) return null;
  const result = pick(media, mediaFields);
  if (result.formats && typeof result.formats === "object") {
    result.formats = Object.fromEntries(Object.entries(result.formats).map(([name, format]) => [name, pick(format, ["name", "url", "width", "height", "mime", "ext", "size"])]));
  }
  return result;
}

function publicEntity(entity: any, definition: ContentDefinition) {
  if (!entity) return null;
  const result = pick(entity, ["documentId", "locale", "publishedAt", ...definition.fields]);
  if (definition.fields.includes("customizableOptions")) result.customizableOptions = Array.isArray(entity.customizableOptions) ? entity.customizableOptions.filter((item: unknown) => typeof item === "string") : [];
  if (definition.fields.includes("productFaqs")) result.productFaqs = publicProductFaqs(entity.productFaqs);
  if (definition.fields.includes("projectFacts")) {
    result.projectFacts = publicProjectRows(entity.projectFacts, ["label", "value"]);
    result.projectFaqs = publicProjectRows(entity.projectFaqs, ["question", "answer"]);
    result.features = Array.isArray(entity.features) ? entity.features.filter(item => typeof item === "string" && item.trim()).map(item => item.trim()) : [];
    // Keep empty positions so step text remains aligned with its media order.
    result.productionSteps = Array.isArray(entity.productionSteps) ? entity.productionSteps.map(item => typeof item === "string" ? item.trim() : "") : [];
  }
  for (const field of definition.media ?? []) result[field] = publicMedia(entity[field]);
  for (const [field, component] of Object.entries(definition.components ?? {})) {
    result[field] = Array.isArray(entity[field]) ? entity[field].map(item => publicEntity(item, component)) : [];
  }
  return result;
}

function publicSelection(definition: ContentDefinition, root = false): any {
  const populate = {
    ...Object.fromEntries((definition.media ?? []).map(field => [field, { fields: mediaFields }])),
    ...Object.fromEntries(Object.entries(definition.components ?? {}).map(([field, component]) => [field, publicSelection(component)]))
  };
  return { fields: [...(root ? ["locale", "publishedAt"] : []), ...definition.fields], ...(Object.keys(populate).length ? { populate } : {}) };
}

// Each anonymous endpoint owns its query and response projection. Client status,
// filters, fields and populate cannot widen the published public content boundary.
export function createPublicContentController(name: string) {
  const definition = definitions[name];
  const uid = `api::${name}.${name}`;
  const selection = publicSelection(definition, true);
  return ({ strapi }: { strapi: any }) => ({
    ...(name === "project-case" ? {
      async findBySlug(ctx: any) {
        let locale: string;
        try { locale = readPublicLocale(ctx.query).locale ?? "en"; }
        catch (error) { return ctx.badRequest((error as Error).message); }
        if (!["en", "fr", "ar"].includes(locale)) return ctx.notFound();
        const slug = ctx.params.slug;
        if (typeof slug !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(slug)) return ctx.notFound();
        const entity = await strapi.documents(uid).findFirst({ ...selection, locale, status: "published", filters: { slug, isVerified: true } });
        if (!entity || !entity.publishedAt || entity.locale !== locale || entity.slug !== slug || entity.isVerified !== true) return ctx.notFound();
        return { data: publicEntity(entity, definition), meta: {} };
      }
    } : {}),
    async find(ctx: any) {
      let locale: { locale?: string }, pagination: ReturnType<typeof readPagination>;
      try {
        locale = readPublicLocale(ctx.query);
        if (!definition.single) pagination = readPagination(ctx.query);
      } catch (error) { return ctx.badRequest((error as Error).message); }
      const documents = strapi.documents(uid);
      if (definition.single) {
        const entity = await documents.findFirst({ ...selection, ...locale, status: "published" });
        return { data: publicEntity(entity, definition), meta: {} };
      }
      const { page, pageSize, start } = pagination!;
      const [entities, total] = await Promise.all([
        documents.findMany({ ...selection, ...locale, status: "published", sort: ["sortOrder:asc", "documentId:asc"], start, limit: pageSize }),
        documents.count({ ...locale, status: "published" })
      ]);
      return { data: entities.map((entity: any) => publicEntity(entity, definition)), meta: { pagination: { page, pageSize, pageCount: Math.ceil(total / pageSize), total } } };
    },
    ...(!definition.single ? {
      async findOne(ctx: any) {
        let locale: { locale?: string };
        try { locale = readPublicLocale(ctx.query); }
        catch (error) { return ctx.badRequest((error as Error).message); }
        const documentId = ctx.params.documentId;
        if (typeof documentId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(documentId)) return ctx.badRequest("Invalid documentId.");
        const entity = await strapi.documents(uid).findOne({ ...selection, ...locale, status: "published", documentId });
        if (!entity) return ctx.notFound();
        return { data: publicEntity(entity, definition), meta: {} };
      }
    } : {})
  });
}

export function createPublicContentRoutes(name: string, path: string, single = false) {
  return {
    routes: [
      { method: "GET", path: `/${path}`, handler: `api::${name}.${name}.find`, config: { auth: false } },
      ...(!single ? [{ method: "GET", path: `/${path}/:documentId`, handler: `api::${name}.${name}.findOne`, config: { auth: false } }] : [])
    ]
  };
}
