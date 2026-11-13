import { notFound } from "next/navigation";
import SitePage from "../../../../../components/site/site-page";
import { sitePage } from "../../../../../lib/site-architecture";
import { brochureHomepage, siteLanguage } from "../../../../../lib/content";
import { loadApplicationContent } from "../../../../../lib/application-content";
import { loadTechnicalDocuments } from "../../../../../lib/document-library-content";

export default async function HomepageSectionPage({ params, searchParams }: { params: Promise<{ section: string; path?: string[] }>; searchParams: Promise<{ lang?: string }> }) {
  const [{ section, path = [] }, query] = await Promise.all([params, searchParams]);
  const language = siteLanguage(query.lang);
  const fullPath = [section, ...path].join("/");
  const products = brochureHomepage(language).products;
  const product = section === "product" && path.length === 1 ? products.find(item => item.slug === path[0]) : undefined;
  if (!product && !sitePage(fullPath)) notFound();
  const applicationPage = section === "applications" && path.length === 1 ? await loadApplicationContent(path[0], language) : null;
  const documentLibraries = fullPath === "resources/technical-documents" ? await loadTechnicalDocuments(language) : [];
  return <SitePage key={`${language}:${fullPath}`} previewRoutes language={language} products={products} view={section} path={fullPath} product={product} applicationPage={applicationPage} documentLibraries={documentLibraries}/>;
}
