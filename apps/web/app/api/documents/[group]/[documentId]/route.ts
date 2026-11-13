import { loadDocumentLibrary } from "../../../../../lib/document-library-content";
import { documentGroups, type DocumentGroup } from "../../../../../lib/document-library";
import type { SiteLanguage } from "../../../../../lib/site-language";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ group: string; documentId: string }> }) {
  const { group, documentId } = await params;
  if (!documentGroups.includes(group as DocumentGroup) || !/^[a-zA-Z0-9_-]{1,128}$/.test(documentId)) return new Response("Document not found.", { status: 404 });
  const locale = new URL(request.url).searchParams.get("lang") || "en";
  if (!["en", "fr", "ar"].includes(locale)) return new Response("Invalid language.", { status: 400 });
  try {
    // Recheck publication before each download; the caller cannot supply a URL.
    const library = await loadDocumentLibrary(group as DocumentGroup, locale as SiteLanguage, true);
    const document = library.documents.find(item => item.id === documentId);
    if (!document) return new Response("Document not found.", { status: 404 });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let upstream: Response;
    try {
      upstream = await fetch(document.fileUrl, { cache: "no-store", redirect: "error", signal: AbortSignal.any([request.signal, controller.signal]) });
    } finally { clearTimeout(timeout); }
    if (!upstream.ok || !upstream.body) return new Response("The document is temporarily unavailable.", { status: 502 });
    const filename = document.fileName.replace(/[\\/\u0000-\u001f\u007f"]/g, "_").slice(0, 180) || "document";
    const ascii = filename.replace(/[^\x20-\x7e]/g, "_");
    const encoded = encodeURIComponent(filename).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    return new Response(upstream.body, { headers: {
      "Content-Type": document.mime,
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    } });
  } catch {
    return new Response("The document service is temporarily unavailable.", { status: 503 });
  }
}
