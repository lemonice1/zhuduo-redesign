import demo from "@modular/contracts/demo-content.json";
import catalogue from "@modular/contracts/company-products.json";
import chineseFaqs from "./data/demo-faqs.zh-Hans.json";

export async function prepareDevelopmentLocales(strapi: any) {
  if (process.env.NODE_ENV !== "development" || process.env.SEED_DEMO_CONTENT !== "true") return;
  const locales = strapi.plugin("i18n").service("locales");
  for (const locale of [{ code: "en", name: "English (en)" }, { code: "zh-Hans", name: "Chinese (Simplified) (zh-Hans)" }]) {
    if (!await locales.findByCode(locale.code)) await locales.create(locale);
  }
}

// Compare editorial fields before changing seeded records. A draft or media edit
// means the administrator has taken ownership of that document.
function matchesProduct(row: any, product: { title: string; summary: string; category: string; detail: string; options: string[] }, imageUrl = "") {
  return row && row.title === product.title && row.summary === product.summary && row.category === product.category &&
    row.detail === product.detail && JSON.stringify(row.customizableOptions) === JSON.stringify(product.options) &&
    (row.imageUrl || "") === imageUrl && !row.image;
}

export async function seedCompanyProducts(strapi: any) {
  if (process.env.NODE_ENV !== "development" || process.env.SEED_DEMO_CONTENT !== "true") return;
  const products = strapi.documents("api::product.product");
  // Import both languages and retire the old examples atomically, so a failed
  // publication cannot leave the public catalogue empty or half imported.
  await strapi.db.transaction(async () => {
    for (const [index, product] of catalogue.products.entries()) {
      const data = (locale: "en" | "zh-Hans") => ({
        slug: product.slug, title: product[locale].title, summary: product[locale].summary,
        category: product[locale].category, detail: product[locale].detail,
        categoryKey: product.categoryKey,
        customizableOptions: product[locale].options, imageUrl: product.imageUrl, sortOrder: index
      });
      const english = await products.findFirst({ filters: { slug: product.slug }, locale: "en", status: "draft", populate: ["image"] }) ??
        await products.create({ locale: "en", status: "published", data: data("en") });
      if (!matchesProduct(english, product.en, product.imageUrl)) continue;
      const live = await products.findOne({ documentId: english.documentId, locale: "en", status: "published", populate: ["image"] });
      if (!matchesProduct(live, product.en, product.imageUrl)) continue;
      const chinese = await products.findOne({ documentId: english.documentId, locale: "zh-Hans", status: "draft" }) ??
        await products.findOne({ documentId: english.documentId, locale: "zh-Hans", status: "published" });
      if (!chinese) {
        await products.update({ documentId: english.documentId, locale: "zh-Hans", data: { ...data("zh-Hans"), sortOrder: english.sortOrder ?? index } });
        await products.publish({ documentId: english.documentId, locale: "zh-Hans" });
      }
    }
    for (const product of demo.products) {
      const draft = await products.findFirst({ filters: { slug: product.slug }, locale: "en", status: "draft", populate: ["image"] });
      if (!matchesProduct(draft, product)) continue;
      const live = await products.findOne({ documentId: draft.documentId, locale: "en", status: "published", populate: ["image"] });
      if (matchesProduct(live, product)) await products.unpublish({ documentId: draft.documentId, locale: "en" });
    }
    // These models were explicitly removed from the company range. Retire both
    // localizations of their document, including a translation with an edited UID.
    const locales = ["en", "zh-Hans"];
    for (const slug of catalogue.retiredProductSlugs) {
      const documentIds = new Set<string>();
      for (const locale of locales) {
        const row = await products.findFirst({ filters: { slug }, locale, status: "draft" }) ??
          await products.findFirst({ filters: { slug }, locale, status: "published" });
        if (row) documentIds.add(row.documentId);
      }
      for (const documentId of documentIds) for (const locale of locales) {
        if (await products.findOne({ documentId, locale, status: "published" })) await products.unpublish({ documentId, locale });
      }
    }
  });
}

export async function seedDevelopmentContent(strapi: any) {
  if (process.env.NODE_ENV !== "development" || process.env.SEED_DEMO_CONTENT !== "true") return;
  await seedCompanyProducts(strapi);
  for (const [index, [question, answer]] of demo.faqs.entries()) {
    const faqs = strapi.documents("api::faq.faq");
    const english = await faqs.findFirst({ filters: { question }, locale: "en", status: "draft" }) ??
      await faqs.create({ locale: "en", status: "published", data: { question, answer, sortOrder: index } });
    // Only backfill the exact, published demo content. Preserve edited English
    // entries and every existing Chinese version, including unpublished drafts.
    if (english.question !== question || english.answer !== answer) continue;
    await strapi.db.transaction(async () => {
      const live = await faqs.findOne({ documentId: english.documentId, locale: "en", status: "published" });
      if (live?.question !== question || live?.answer !== answer) return;
      const chinese = await faqs.findOne({ documentId: english.documentId, locale: "zh-Hans", status: "draft" }) ??
        await faqs.findOne({ documentId: english.documentId, locale: "zh-Hans", status: "published" });
      if (chinese) return;
      const [translatedQuestion, translatedAnswer] = chineseFaqs[index];
      await faqs.update({ documentId: english.documentId, locale: "zh-Hans", data: { question: translatedQuestion, answer: translatedAnswer } });
      await faqs.publish({ documentId: english.documentId, locale: "zh-Hans" });
    });
  }
  const settings = await strapi.documents("api::site-setting.site-setting").findFirst({ locale: "en", status: "draft" });
  if (!settings) await strapi.documents("api::site-setting.site-setting").create({ locale: "en", status: "published", data: demo.settings });
}
