import "server-only";
import { validProjectSlug } from "./project-detail";
import demo from "@modular/contracts/demo-content.json";
import catalogue from "@modular/contracts/company-products.json";
import arabicProducts from "@modular/contracts/company-products.ar.json";
import arabicContent from "@modular/contracts/site-content.ar.json";
import frenchProducts from "@modular/contracts/company-products.fr.json";
import frenchContent from "@modular/contracts/site-content.fr.json";
import type { SiteLanguage } from "./site-language";
import type { ProductCategoryDefinition } from "./product-categories";
import { loadProductCategories } from "./product-category-content";
export { siteLanguage } from "./site-language";
type ContentLocale = SiteLanguage | "zh-Hans";

export type Product = {
  slug: string; category: string; eyebrow: string; title: string; summary: string; detail: string;
  options: string[]; tone: "sunset" | "slate" | "copper" | ""; imageUrl: string; categoryKey?: string;
  galleryUrls?: string[]; brochureUrl?: string;
  productFaqs?: { question: string; answer: string }[];
  featured?: boolean;
};
export type SiteSettings = {
  siteName: string; contactEmail: string; footerNote: string;
  whatsappNumber?: string; companyAddress?: string; companyIntro?: string;
  foundedYear?: number; factoryArea?: number; exportMarkets?: number; certificationCount?: number;
  factoryImageUrl?: string; heroHousingImageUrl?: string; heroElectricalImageUrl?: string;
  exhibitionName?: string; exhibitionDetails?: string;
};
export type ProjectCase = { title: string; location: string; productName: string; quantity: string; summary: string; imageUrl: string; publishedAt?: string; slug?: string };
export type SiteDocument = { title: string; url: string; imageUrl?: string };
export type HomepageContent = {
  productCategories?: ProductCategoryDefinition[];
  products: Product[]; faqs: [string, string][];
  settings: SiteSettings | null;
  cases?: ProjectCase[]; certificates?: SiteDocument[];
};

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";

function imageUrl(value: unknown, cmsUrl?: string): string {
  const candidate = text(value);
  if (!candidate) return "";
  // Brochure images ship with the frontend; uploaded media still belongs to CMS.
  if (catalogue.products.some(product => product.imageUrl === candidate || (product.galleryUrls as string[]).includes(candidate)) || catalogue.legacyProducts.some(product => product.imageUrl === candidate)) return candidate;
  try {
    const url = new URL(candidate, cmsUrl);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}

function normalizeHomepage(body: unknown, cmsUrl?: string): HomepageContent {
  if (!record(body) || !Array.isArray(body.products) || !Array.isArray(body.faqs)) throw new Error("Invalid CMS content.");
  const productKeys = new Set<string>();
  const products: Product[] = [];
  for (const item of body.products) {
    if (!record(item)) continue;
    const slug = text(item.slug), title = text(item.title);
    if (!slug || !title || productKeys.has(slug) || catalogue.retiredProductSlugs.includes(slug)) continue;
    productKeys.add(slug);
    products.push({
      slug, title, category: text(item.category) || text(item.eyebrow).split(" / ").slice(1).join(" / "), eyebrow: text(item.eyebrow), summary: text(item.summary), detail: text(item.detail),
      ...(text(item.categoryKey) ? { categoryKey: text(item.categoryKey) } : {}),
      options: Array.isArray(item.options) ? [...new Set(item.options.filter((option): option is string => typeof option === "string").map(text).filter(Boolean))] : [],
      tone: item.tone === "sunset" || item.tone === "slate" || item.tone === "copper" ? item.tone : "",
      imageUrl: imageUrl(item.imageUrl, cmsUrl),
      ...(Array.isArray(item.galleryUrls) ? { galleryUrls: [...new Set(item.galleryUrls.map(value => imageUrl(value, cmsUrl)).filter(Boolean))].slice(0, 24) } : {}),
      ...(text(item.brochureUrl) ? { brochureUrl: imageUrl(item.brochureUrl, cmsUrl) } : {}),
      ...(Array.isArray(item.productFaqs) ? { productFaqs: item.productFaqs.filter(record).flatMap(row => text(row.question) && text(row.answer) ? [{ question: text(row.question), answer: text(row.answer) }] : []) } : {}),
      ...(typeof item.featured === "boolean" ? { featured: item.featured } : {})
    });
  }
  const faqKeys = new Set<string>();
  const faqs: [string, string][] = [];
  for (const pair of body.faqs) {
    if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== "string" || typeof pair[1] !== "string") continue;
    const question = text(pair[0]), answer = text(pair[1]);
    if (!question || !answer || faqKeys.has(question)) continue;
    faqKeys.add(question);
    faqs.push([question, answer]);
  }
  const settings = record(body.settings) ? {
    // Existing installations may still return the original seeded placeholders.
    siteName: /^northline(?:\s+modular)?$/i.test(text(body.settings.siteName)) ? "ZhuDuo" : text(body.settings.siteName),
    contactEmail: text(body.settings.contactEmail).toLowerCase() === "hello@northlinemodular.example" ? "" : text(body.settings.contactEmail),
    footerNote: text(body.settings.footerNote),
    ...Object.fromEntries(["companyAddress", "companyIntro", "exhibitionName", "exhibitionDetails"].flatMap(key => text(body.settings && (body.settings as Record<string, unknown>)[key]) ? [[key, text((body.settings as Record<string, unknown>)[key])]] : [])),
    ...Object.fromEntries(["factoryImageUrl", "heroHousingImageUrl", "heroElectricalImageUrl"].flatMap(key => { const url = imageUrl((body.settings as Record<string, unknown>)[key], cmsUrl); return url ? [[key, url]] : []; })),
    ...Object.fromEntries(["foundedYear", "factoryArea", "exportMarkets", "certificationCount"].flatMap(key => {
      const raw = (body.settings as Record<string, unknown>)[key];
      if ((typeof raw !== "number" && typeof raw !== "string") || String(raw).trim() === "") return [];
      const value = Number(raw);
      return Number.isFinite(value) && value >= 0 && (key !== "foundedYear" || (Number.isInteger(value) && value >= 1800 && value <= 2100)) && (key === "factoryArea" || Number.isInteger(value)) ? [[key, value]] : [];
    })),
    ...(() => {
      const raw = text((body.settings as Record<string, unknown>).whatsappNumber), digits = raw.replace(/\D/g, "");
      return /^[+\d\s()-]+$/.test(raw) && digits.length >= 7 && digits.length <= 15 ? { whatsappNumber: digits } : {};
    })()
  } : null;
  const cases: ProjectCase[] = Array.isArray(body.cases) ? body.cases.filter(record).map(item => ({ title: text(item.title), location: text(item.location), productName: text(item.productName), quantity: text(item.quantity), summary: text(item.summary), ...(validProjectSlug(item.slug) ? { slug: item.slug } : {}), imageUrl: imageUrl(item.imageUrl, cmsUrl), ...(text(item.publishedAt) && Number.isFinite(Date.parse(text(item.publishedAt))) ? { publishedAt: text(item.publishedAt) } : {}) })).filter(item => item.title && item.location && item.productName && item.quantity && item.imageUrl).slice(0, 3) : [];
  const documentKeys = new Set<string>();
  const certificates: SiteDocument[] = Array.isArray(body.certificates) ? body.certificates.filter(record).flatMap(item => {
    const title = text(item.title), url = imageUrl(item.url, cmsUrl), thumbnail = imageUrl(item.imageUrl, cmsUrl);
    if (!title || !url || documentKeys.has(url)) return [];
    documentKeys.add(url);
    return [{ title, url, ...(thumbnail ? { imageUrl: thumbnail } : {}) }];
  }).slice(0, 12) : [];
  return { products, faqs, settings, ...(Array.isArray(body.cases) ? { cases } : {}), ...(Array.isArray(body.certificates) ? { certificates } : {}) };
}

export async function loadHomepage(locale?: ContentLocale): Promise<HomepageContent> {
  const cmsUrl = process.env.STRAPI_PUBLIC_URL;
  if (!cmsUrl) {
    if (process.env.NODE_ENV === "development") return brochureHomepage(locale || "en");
    throw new Error("STRAPI_PUBLIC_URL is required.");
  }
  const response = await fetch(`${cmsUrl.replace(/\/$/, "")}/api/homepage${locale ? `?locale=${locale}` : ""}`, {
    next: { revalidate: 30 }, signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error("CMS content is unavailable.");
  return normalizeHomepage(await response.json(), cmsUrl);
}

// This explicit switch is used only by the local review server. CMS failures
// in normal production continue to surface instead of showing demo products.
export const localSitePreview = () => process.env.SITE_PREVIEW_MODE === "true";


export function brochureHomepage(locale: ContentLocale): HomepageContent {
  const translations = locale === "ar" ? arabicProducts : locale === "fr" ? frenchProducts : null;
  const content = locale === "ar" ? arabicContent : locale === "fr" ? frenchContent : demo;
  return normalizeHomepage({
    products: catalogue.products.map(product => ({ ...(translations ? translations[product.slug as keyof typeof translations] : product[locale === "zh-Hans" ? "zh-Hans" : "en"]), slug: product.slug, categoryKey: product.categoryKey, imageUrl: product.imageUrl, galleryUrls: product.galleryUrls })),
    faqs: locale === "zh-Hans" ? [] : content.faqs, settings: content.settings
  });
}

export async function loadSiteHomepage(locale: ContentLocale): Promise<HomepageContent> {
  if (localSitePreview()) return brochureHomepage(locale);
  const [content, products, productCategories] = await Promise.all([loadHomepage(locale), loadCatalogue(locale), loadProductCategories()]);
  return { ...content, products, ...(productCategories ? { productCategories } : {}) };
}

export async function loadCatalogue(locale: ContentLocale): Promise<Product[]> {
  const cmsUrl = process.env.STRAPI_PUBLIC_URL;
  if (localSitePreview() || (!cmsUrl && process.env.NODE_ENV === "development")) return brochureHomepage(locale).products;
  if (!cmsUrl) throw new Error("STRAPI_PUBLIC_URL is required.");
  const products: Product[] = [];
  let page = 1;
  let pageCount = 1;
  do {
    const query = new URLSearchParams({ locale, "pagination[page]": String(page), "pagination[pageSize]": "100" });
    const response = await fetch(`${cmsUrl.replace(/\/$/, "")}/api/products?${query}`, { next: { revalidate: 30 }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error("CMS catalogue is unavailable.");
    const body: unknown = await response.json();
    if (!record(body) || !Array.isArray(body.data) || !record(body.meta) || !record(body.meta.pagination)) throw new Error("Invalid CMS catalogue.");
    const pagination = body.meta.pagination;
    if (pagination.page !== page || pagination.pageSize !== 100 || !Number.isSafeInteger(pagination.pageCount) || (pagination.pageCount as number) < 0 || (pagination.pageCount as number) > 1000) throw new Error("Invalid CMS pagination.");
    pageCount = pagination.pageCount as number;
    const rows = body.data.filter(record).map(item => ({ ...item, options: item.customizableOptions, imageUrl: record(item.image) ? item.image.url ?? item.imageUrl : item.imageUrl,
      galleryUrls: Array.isArray(item.gallery) ? item.gallery.filter(record).map(image => image.url) : [],
      brochureUrl: record(item.brochure) ? item.brochure.url : "" }));
    products.push(...normalizeHomepage({ products: rows, faqs: [], settings: null }, cmsUrl).products);
    page++;
  } while (page <= pageCount);
  return [...new Map(products.map(product => [product.slug, product])).values()];
}
