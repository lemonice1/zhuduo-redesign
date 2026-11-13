import { applicationFields, applicationMedia, applicationTypes } from "./application-pages";
import { documentLibraryAdminFields, documentLibraryTypes } from "./document-libraries";
import { productCategoryAdminFields } from "./product-categories";
import { projectFields, projectMedia } from "./project-content";

const contentFields = {
  "product-category": productCategoryAdminFields,
  ...Object.fromEntries(documentLibraryTypes.map(name => [name, documentLibraryAdminFields])),
  ...Object.fromEntries(applicationTypes.map(name => [name, [...applicationFields, ...applicationMedia]])),
  product: ["slug", "title", "summary", "category", "categoryKey", "detail", "customizableOptions", "productFaqs", "imageUrl", "image", "gallery", "brochure", "sourceReference", "sortOrder", "featured"],
  "project-case": [...projectFields, ...projectMedia],
  article: ["slug", "title", "summary", "body", "coverImage", "sortOrder"],
  certificate: ["slug", "title", "description", "issuer", "document", "sortOrder"],
  faq: ["question", "answer", "sortOrder"],
  "site-setting": ["siteName", "contactEmail", "footerNote", "whatsappNumber", "companyAddress", "companyIntro", "foundedYear", "factoryArea", "exportMarkets", "certificationCount", "factoryImage", "heroHousingImage", "heroElectricalImage", "exhibitionName", "exhibitionDetails"]
};

export async function provisionAdminRoles(strapi: any) {
  const roles = strapi.service("admin::role");
  const definitions = [
    { code: "modular-operations", name: "Operations", description: "Manage published website content and public media." },
    { code: "modular-sales", name: "Sales", description: "Read inquiries and update follow-up status and internal notes." }
  ];
  for (const definition of definitions) {
    // Atomic role + grants: a failed initial assignment must not leave an empty
    // role that later boots would mistake for a manually customized role.
    await strapi.db.transaction(async () => {
      if (await roles.findOne({ code: definition.code })) return;
      let permissions: any[];
      if (definition.code === "modular-operations") {
        const locales = (await strapi.plugin("i18n").service("locales").find()).map(locale => locale.code);
        if (!locales.length) throw new Error("Operations requires at least one configured content locale.");
        permissions = Object.entries(contentFields).flatMap(([name, fields]) =>
          ["create", "read", "update", "delete", "publish"].map(action => ({
            action: `plugin::content-manager.explorer.${action}`,
            subject: `api::${name}.${name}`,
            properties: { ...(name === "product-category" ? {} : { locales }), ...(["create", "read", "update"].includes(action) ? { fields } : {}) },
            conditions: []
          }))
        );
        // In pinned Strapi, assets.update includes file/folder deletion.
        permissions.push(...["read", "assets.create", "assets.update"].map(action => ({
          action: `plugin::upload.${action}`, subject: null, properties: {}, conditions: []
        })));
      } else {
        permissions = [
          { action: "plugin::content-manager.explorer.read", subject: "api::inquiry.inquiry", properties: { fields: ["name", "email", "whatsapp", "country", "productType", "quantity", "message", "source", "followUpStatus", "internalNotes"] }, conditions: [] },
          { action: "plugin::content-manager.explorer.update", subject: "api::inquiry.inquiry", properties: { fields: ["followUpStatus", "internalNotes"] }, conditions: [] }
        ];
      }
      const role = await roles.create(definition);
      await roles.assignPermissions(role.id, permissions);
    });
  }
}

export function guardI18nSettings(strapi: any) {
  const route = strapi.plugin("i18n").routes.admin.routes.find(route => route.method === "PUT" && route.path === "/settings");
  if (!route) throw new Error("Expected Strapi i18n settings route was not found.");
  const policies = route.config.policies;
  if (!policies.some(policy => typeof policy === "object" && policy.name === "admin::hasPermissions")) {
    policies.push({ name: "admin::hasPermissions", config: { actions: ["admin::project-settings.update"] } });
  }
}
