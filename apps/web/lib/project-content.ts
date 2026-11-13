import "server-only";
import { validProjectSlug, type ProjectDetail, type ProjectImage } from "./project-detail";
import type { SiteLanguage } from "./site-language";

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
function publicUrl(value: unknown, base: string) {
  if (!text(value)) return "";
  try {
    const url = new URL(text(value), base);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}

export function normalizeProjectDetail(data: unknown, slug: string, locale: SiteLanguage, cmsUrl: string): ProjectDetail | null {
  if (!record(data) || !data.publishedAt || data.locale !== locale || data.isVerified !== true || data.slug !== slug || !text(data.title)) return null;
  const base = `${cmsUrl.replace(/\/$/, "")}/`;
  const image = (value: unknown): ProjectImage | null => {
    if (!record(value)) return null;
    const url = publicUrl(value.url, base);
    return url ? { url, alt: text(value.alternativeText) || text(data.title), caption: text(value.caption) } : null;
  };
  const images = (value: unknown) => Array.isArray(value) ? value.map(image).filter((item): item is ProjectImage => item !== null) : [];
  const main = image(data.image) || (publicUrl(data.imageUrl, base) ? { url: publicUrl(data.imageUrl, base), alt: text(data.title), caption: "" } : null);
  const gallery = [...(main ? [main] : []), ...images(data.gallery)].filter((item, index, all) => all.findIndex(other => other.url === item.url) === index);
  const pairs = (value: unknown, a: string, b: string) => Array.isArray(value) ? value.filter(record).flatMap(row => text(row[a]) && text(row[b]) ? [{ [a]: text(row[a]), [b]: text(row[b]) }] : []) : [];
  const steps = Array.isArray(data.productionSteps) ? data.productionSteps.map(text) : [];
  return {
    slug, documentId: text(data.documentId), title: text(data.title), summary: text(data.summary), location: text(data.location), productName: text(data.productName), quantity: text(data.quantity), application: text(data.application),
    gallery, projectFacts: pairs(data.projectFacts, "label", "value") as ProjectDetail["projectFacts"],
    detail: text(data.detail), introImage: image(data.introImage), features: Array.isArray(data.features) ? data.features.map(text).filter(Boolean) : [],
    detailImages: images(data.detailImages), certificateImages: images(data.certificateImages), videoUrl: record(data.video) ? publicUrl(data.video.url, base) : "",
    productionText: text(data.productionText), productionImages: images(data.productionImages).map((picture, index) => ({ ...picture, caption: steps[index] || picture.caption })), referenceImages: images(data.referenceImages),
    shippingText: text(data.shippingText), shippingImages: images(data.shippingImages), projectFaqs: pairs(data.projectFaqs, "question", "answer") as ProjectDetail["projectFaqs"], mediaBaseUrl: base
  };
}

export async function loadProjectDetail(slug: string, locale: SiteLanguage): Promise<ProjectDetail | null> {
  if (!validProjectSlug(slug) || process.env.SITE_PREVIEW_MODE === "true") return null;
  if (!["en", "fr", "ar"].includes(locale)) return null;
  const cmsUrl = process.env.STRAPI_PUBLIC_URL?.replace(/\/$/, "");
  if (!cmsUrl) {
    if (process.env.NODE_ENV === "development") return null;
    throw new Error("STRAPI_PUBLIC_URL is required.");
  }
  const response = await fetch(`${cmsUrl}/api/project-cases/slug/${encodeURIComponent(slug)}?${new URLSearchParams({ locale })}`, { next: { revalidate: 30 }, signal: AbortSignal.timeout(10_000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("CMS project content is unavailable.");
  const envelope: unknown = await response.json();
  if (!record(envelope) || !(envelope.data === null || record(envelope.data))) throw new Error("Invalid CMS project content.");
  return normalizeProjectDetail(envelope.data, slug, locale, cmsUrl);
}
