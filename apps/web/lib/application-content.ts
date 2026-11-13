import "server-only";
import type { SiteLanguage } from "./site-language";

const applicationEndpoints: Record<string, string> = {
  "energy-utilities": "application-energy-utilities",
  "industrial-projects": "application-industrial-projects",
  "residential-hospitality": "application-residential-hospitality",
  "commercial-temporary-buildings": "application-commercial-temporary-buildings"
};

export type ApplicationContent = {
  title: string;
  summary: string;
  body: string;
  coverImageUrl: string;
  coverImageAlt: string;
  mediaBaseUrl: string;
};

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

export async function loadApplicationContent(slug: string, locale: SiteLanguage): Promise<ApplicationContent | null> {
  const endpoint = Object.hasOwn(applicationEndpoints, slug) ? applicationEndpoints[slug] : undefined;
  if (!endpoint || process.env.SITE_PREVIEW_MODE === "true") return null;
  if (!["en", "fr", "ar"].includes(locale)) throw new Error("Unsupported application language.");
  const cmsUrl = process.env.STRAPI_PUBLIC_URL?.replace(/\/$/, "");
  if (!cmsUrl) {
    if (process.env.NODE_ENV === "development") return null;
    throw new Error("STRAPI_PUBLIC_URL is required.");
  }
  const response = await fetch(`${cmsUrl}/api/${endpoint}?${new URLSearchParams({ locale })}`, {
    next: { revalidate: 30 }, signal: AbortSignal.timeout(10_000)
  });
  // Permit CMS/Web to be upgraded separately without breaking existing URLs.
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("CMS application content is unavailable.");
  const envelope: unknown = await response.json();
  if (!record(envelope)) throw new Error("Invalid CMS application content.");
  if (envelope.data === null) return null;
  const data = envelope.data;
  if (!record(data)) throw new Error("Invalid CMS application content.");
  // Only published documents in the requested locale may replace the old page.
  if (!text(data.publishedAt) || data.locale !== locale) return null;
  const title = text(data.title), body = text(data.body);
  if (!title || !body) return null;
  const cover = record(data.coverImage) ? data.coverImage : {};
  let coverImageUrl = "";
  if (text(cover.url)) {
    try {
      const url = new URL(text(cover.url), `${cmsUrl}/`);
      if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) coverImageUrl = url.href;
    } catch { /* An invalid optional image must not invalidate the article. */ }
  }
  return { title, summary: text(data.summary), body, coverImageUrl, coverImageAlt: text(cover.alternativeText) || title, mediaBaseUrl: `${cmsUrl}/` };
}
