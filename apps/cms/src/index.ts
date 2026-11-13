import { prepareDevelopmentLocales, seedDevelopmentContent } from "./seed";
import { guardI18nSettings, provisionAdminRoles } from "./lib/admin-roles";
import { registerAutoTranslation } from "./lib/auto-translation";
import { registerProductCategories, seedProductCategories } from "./lib/product-categories";

export default {
  register({ strapi }) {
    guardI18nSettings(strapi);
    registerAutoTranslation(strapi);
    registerProductCategories(strapi);
  },
  async bootstrap({ strapi }) {
    await prepareDevelopmentLocales(strapi);
    await provisionAdminRoles(strapi);
    await seedProductCategories(strapi);
    await seedDevelopmentContent(strapi);
  }
};
