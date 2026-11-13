import catalogue from "@modular/contracts/company-products.json";
import arabicProducts from "@modular/contracts/company-products.ar.json";
import frenchProducts from "@modular/contracts/company-products.fr.json";
import arabicContent from "@modular/contracts/site-content.ar.json";
import frenchContent from "@modular/contracts/site-content.fr.json";
import demo from "@modular/contracts/demo-content.json";

type Result = { type: string; key: string; action: "create" | "preserved" | "source-changed" | "source-missing" };

// Add missing localizations to existing documents. Existing translations,
// editorial drafts, media, English and Chinese records always remain owned by editors.
export async function backfillLanguage(strapi: any, locale: "ar" | "fr", apply = false, localeExists = true, options: { productsOnly?: boolean } = {}): Promise<Result[]> {
  const products = locale === "ar" ? arabicProducts : frenchProducts;
  const content = locale === "ar" ? arabicContent : frenchContent;
  const results: Result[] = [];
  async function add(type: string, key: string, source: any, expected: Record<string, unknown>, translated: Record<string, unknown>) {
    const documents = strapi.documents(`api::${type}.${type}`);
    let action: Result["action"];
    if (!source) action = "source-missing";
    else {
      const existing = localeExists ? await documents.findOne({ documentId: source.documentId, locale, status: "draft" }) ??
        await documents.findOne({ documentId: source.documentId, locale, status: "published" }) : null;
      const draft = await documents.findOne({ documentId: source.documentId, locale: "en", status: "draft" });
      const matches = (row: any) => row && Object.entries(expected).every(([field, value]) => JSON.stringify(row[field] ?? "") === JSON.stringify(value));
      action = existing ? "preserved" : matches(source) && matches(draft) ? "create" : "source-changed";
      if (apply && action === "create") await strapi.db.transaction(async () => {
        const latestDraft = await documents.findOne({ documentId: source.documentId, locale: "en", status: "draft" });
        const latestLive = await documents.findOne({ documentId: source.documentId, locale: "en", status: "published" });
        const existingTranslation = await documents.findOne({ documentId: source.documentId, locale, status: "draft" }) ??
          await documents.findOne({ documentId: source.documentId, locale, status: "published" });
        if (existingTranslation || !matches(latestDraft) || !matches(latestLive)) throw new Error(`Content changed during ${locale} backfill: ${type}/${key}. Run the preview again.`);
        await documents.update({ documentId: source.documentId, locale, data: { ...translated, ...(source.slug ? { slug: source.slug } : {}) } });
        const saved = await documents.publish({ documentId: source.documentId, locale });
        if (!saved?.entries?.length) throw new Error(`${locale} publication failed: ${type}/${key}`);
      });
    }
    results.push({ type, key, action });
  }
  const documents = strapi.documents("api::product.product");
  for (const product of catalogue.products) {
    const source = await documents.findFirst({ filters: { slug: product.slug }, locale: "en", status: "published" });
    const translated = products[product.slug as keyof typeof products];
    await add("product", product.slug, source,
      { title: product.en.title, summary: product.en.summary, category: product.en.category, detail: product.en.detail, customizableOptions: product.en.options },
      { title: translated.title, summary: translated.summary, category: translated.category, detail: translated.detail, customizableOptions: translated.options });
  }
  if (options.productsOnly) return results;
  for (const [index, [question, answer]] of demo.faqs.entries()) {
    const source = await strapi.documents("api::faq.faq").findFirst({ filters: { question }, locale: "en", status: "published" });
    const [translatedQuestion, translatedAnswer] = content.faqs[index];
    await add("faq", question, source, { question, answer }, { question: translatedQuestion, answer: translatedAnswer });
  }
  const settings = await strapi.documents("api::site-setting.site-setting").findFirst({ locale: "en", status: "published" });
  await add("site-setting", "site-setting", settings, { footerNote: demo.settings.footerNote }, { siteName: settings?.siteName || "ZhuDuo", footerNote: content.settings.footerNote });
  return results;
}
