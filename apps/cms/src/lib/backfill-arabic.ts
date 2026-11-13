import { backfillLanguage } from "./backfill-language";

export const backfillArabic = (strapi: any, apply = false, localeExists = true) => backfillLanguage(strapi, "ar", apply, localeExists);
