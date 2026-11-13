import "server-only";
import { documentCopy, documentGroups, type DocumentGroup, type DocumentLibrary } from "./document-library";
import type { SiteLanguage } from "./site-language";

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

export async function loadDocumentLibrary(group: DocumentGroup, locale: SiteLanguage, fresh = false): Promise<DocumentLibrary> {
  if (!documentGroups.includes(group) || !["en", "fr", "ar"].includes(locale)) throw new Error("Unsupported document library.");
  const empty: DocumentLibrary = { group, title: documentCopy[locale][group], summary: "", documents: [] };
  if (process.env.SITE_PREVIEW_MODE === "true") return empty;
  const cmsUrl = process.env.STRAPI_PUBLIC_URL?.replace(/\/$/, "");
  if (!cmsUrl) {
    if (process.env.NODE_ENV === "development") return empty;
    throw new Error("STRAPI_PUBLIC_URL is required.");
  }
  const response = await fetch(`${cmsUrl}/api/technical-documents-${group}?${new URLSearchParams({ locale })}`, {
    ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: 30 } }), signal: AbortSignal.timeout(10_000)
  });
  if (response.status === 404) return empty;
  if (!response.ok) throw new Error("CMS documents are unavailable.");
  const envelope: unknown = await response.json();
  if (!record(envelope)) throw new Error("Invalid CMS documents.");
  const data = envelope.data;
  if (data === null) return empty;
  if (!record(data)) throw new Error("Invalid CMS documents.");
  if (!text(data.publishedAt) || data.locale !== locale) return empty;
  if (!Array.isArray(data.documents)) throw new Error("Invalid CMS document list.");
  const seen = new Set<string>();
  const documents = data.documents.filter(record).flatMap(item => {
    if (!text(item.title) || !record(item.file)) return [];
    const file = item.file;
    // Strapi clones component rows on publication. Media document IDs stay stable.
    const id = text(file.documentId);
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id) || seen.has(id)) return [];
    let url: URL;
    try { url = new URL(text(file.url), `${cmsUrl}/`); } catch { return []; }
    if (!text(file.url) || !["http:", "https:"].includes(url.protocol) || url.username || url.password) return [];
    seen.add(id);
    const extension = text(file.ext).replace(/^\./, "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
    return [{ id, title: text(item.title), description: text(item.description), fileName: text(file.name) || `document${extension ? `.${extension}` : ""}`, fileUrl: url.href, format: extension.toUpperCase() || "FILE", mime: /^[\w.+-]+\/[\w.+-]+$/.test(text(file.mime)) ? text(file.mime) : "application/octet-stream", sizeKb: typeof file.size === "number" && Number.isFinite(file.size) && file.size > 0 ? file.size : 0 }];
  });
  return { group, title: text(data.title) || empty.title, summary: text(data.summary), documents };
}

export const loadTechnicalDocuments = (locale: SiteLanguage) => Promise.all(documentGroups.map(group => loadDocumentLibrary(group, locale)));
