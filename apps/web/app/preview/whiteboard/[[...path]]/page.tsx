import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OriginalWhiteboardSite from "../../../../components/whiteboard/original/original-site";
import { siteLanguage } from "../../../../lib/site-language";
import { loadWhiteboardPreview } from "../../../../lib/whiteboard-preview";
import { previewProjectSlug } from "../../../../lib/whiteboard-preview-routes";
import { validProjectSlug } from "../../../../lib/project-detail";
import { loadProjectDetail } from "../../../../lib/project-content";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ZHUDUO · Design preview", robots: { index: false, follow: false } };
export default async function WhiteboardDesignPreview({ params, searchParams }: {
  params: Promise<{ path?: string[] }>; searchParams: Promise<{ lang?: string; collection?: string }>;
}) {
  const [{ path = [] }, query] = await Promise.all([params, searchParams]);
  const language = siteLanguage(query.lang);
  if (path.length && !(path.length === 1 && ["products", "projects", "about"].includes(path[0]) || path.length === 2 && (path[0] === "products" || path[0] === "projects" && validProjectSlug(path[1])))) notFound();
  const { content, project: defaultProject } = await loadWhiteboardPreview(language);
  const project = path[0] === "projects" && path.length === 2 && path[1] !== previewProjectSlug ? await loadProjectDetail(path[1], language) : defaultProject;
  if (!project) notFound();
  const product = path[0] === "products" && path.length === 2 ? content.products.find(product => product.slug === path[1]) : undefined;
  if (path[0] === "products" && path.length === 2 && !product) notFound();
  const view = path[0] === "projects" ? path.length === 2 ? "project" : "projects" : path[0] === "products" ? product ? "product" : "catalogue" : path[0] === "about" ? "about" : "home";
  return <OriginalWhiteboardSite key={`${language}:${path.join("/")}:${query.collection || ""}`} content={content} project={project} product={product} language={language} view={view} collection={query.collection}/>;
}
