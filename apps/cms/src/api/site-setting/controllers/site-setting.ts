import { createPublicContentController, readPublicLocale, siteSettingFields, siteSettingMedia } from "../../../lib/public-content";
import { publicProductFaqs } from "../../../lib/product-content";

export default ({ strapi }: { strapi: any }) => ({
  ...createPublicContentController("site-setting")({ strapi }),
  async homepage(ctx: any) {
    let locale: { locale?: string };
    try { locale = readPublicLocale(ctx.query); }
    catch (error) { return ctx.badRequest((error as Error).message); }
    const [products, faqs, settings, cases, certificates] = await Promise.all([
      strapi.documents("api::product.product").findMany({ ...locale, status: "published", sort: "sortOrder:asc", limit: 12, fields: ["slug", "title", "summary", "category", "categoryKey", "detail", "customizableOptions", "productFaqs", "imageUrl", "featured"], populate: { image: { fields: ["url"] }, gallery: { fields: ["url"] }, brochure: { fields: ["url"] } } }),
      strapi.documents("api::faq.faq").findMany({ ...locale, status: "published", sort: "sortOrder:asc", limit: 20, fields: ["question", "answer"] }),
      strapi.documents("api::site-setting.site-setting").findFirst({ ...locale, status: "published", fields: siteSettingFields, populate: Object.fromEntries(siteSettingMedia.map(key => [key, { fields: ["url"] }])) }),
      strapi.documents("api::project-case.project-case").findMany({ ...locale, status: "published", filters: { isVerified: true }, sort: "sortOrder:asc", limit: 3, fields: ["slug", "title", "location", "productName", "quantity", "summary", "imageUrl", "isVerified", "publishedAt"], populate: { image: { fields: ["url"] } } }),
      strapi.documents("api::certificate.certificate").findMany({ ...locale, status: "published", sort: ["sortOrder:asc", "documentId:asc"], limit: 12, fields: ["title", "issuer", "description"], populate: { document: { fields: ["url", "mime"] } } })
    ]);

    // Select public fields explicitly. Inquiry data is never part of this API.
    return {
      products: products.map((product: any, index: number) => ({
        slug: product.slug,
        category: product.category,
        categoryKey: product.categoryKey,
        featured: product.featured === true,
        eyebrow: `${String(index + 1).padStart(2, "0")} / ${product.category.toUpperCase()}`,
        title: product.title,
        summary: product.summary,
        detail: product.detail ?? product.summary,
        options: Array.isArray(product.customizableOptions) ? product.customizableOptions.filter((item: unknown) => typeof item === "string") : [],
        productFaqs: publicProductFaqs(product.productFaqs),
        tone: ["sunset", "slate", "copper"][index % 3],
        imageUrl: product.image?.url ?? product.imageUrl ?? "",
        galleryUrls: (product.gallery ?? []).map((image: any) => image.url),
        brochureUrl: product.brochure?.url ?? ""
      })),
      faqs: faqs.map((faq: any) => [faq.question, faq.answer]),
      settings: settings ? { ...Object.fromEntries(siteSettingFields.filter(key => settings[key] !== undefined).map(key => [key, settings[key]])), ...Object.fromEntries(siteSettingMedia.filter(key => settings[key]?.url).map(key => [`${key}Url`, settings[key].url])) } : null,
      cases: cases.filter((item: any) => item.isVerified === true).map((item: any) => ({ ...(item.slug ? { slug: item.slug } : {}), title: item.title, location: item.location, productName: item.productName, quantity: item.quantity, summary: item.summary, imageUrl: item.image?.url || item.imageUrl || "", ...(item.publishedAt ? { publishedAt: item.publishedAt } : {}) })),
      certificates: certificates.filter((item: any) => item.document?.url).map((item: any) => ({ title: item.title, url: item.document.url, ...(item.document.mime?.startsWith("image/") ? { imageUrl: item.document.url } : {}) }))
    };
  }
});
