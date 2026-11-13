import "server-only";
import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { divisions } from "./catalogue";
import { loadSiteHomepage } from "./content";
import { loadApplicationContent } from "./application-content";
import { loadTechnicalDocuments } from "./document-library-content";
import { loadProjectDetail } from "./project-content";
import { createSiteArchitecture, legacyCategoryPath, siteHref, sitePage } from "./site-architecture";
import type { SiteLanguage } from "./site-language";

export const productSection = sitePage;

export const resolveSiteProductPage = cache(async (division: string, segments: string[], language: SiteLanguage) => {
  const path = [division, ...segments].join("/");
  if (!["electrical", "modular-buildings", "modular-housing"].includes(division)) notFound();
  const content = await loadSiteHomepage(language);
  const architecture = createSiteArchitecture(content.productCategories);
  const page = architecture.page(path);
  const categoryPath = [division, ...segments.slice(0, -1)].join("/");
  const category = segments.length > 0 ? architecture.page(categoryPath) : undefined;
  const legacyDivision = divisions.find(item => item.slug === division);
  const legacyCategory = legacyDivision?.categories.find(item => item.slug === segments[0]);
  if (!page && !category && !(legacyDivision && (segments.length === 0 || legacyCategory && segments.length <= 2))) notFound();
  if (page) return { path, page, content, language, product: undefined };
  if (category) {
    const product = content.products.find(item => item.slug === segments.at(-1) && architecture.categoryPath(item) === categoryPath);
    if (product) return { path: categoryPath, page: category, product, content, language };
  }
  if (segments.length === 2 && legacyCategory) {
    // Editors may adopt a new category key after launch; old links still resolve
    // by published slug within the original division, then use its current URL.
    const prefix = division === "modular-housing" ? "modular-buildings/" : "electrical/";
    const product = content.products.find(item => item.slug === segments[1] && architecture.categoryPath(item).startsWith(prefix));
    if (!product) notFound();
    permanentRedirect(architecture.productHref(product, language));
  }
  const target = legacyCategoryPath(division, segments[0]);
  if (target && architecture.page(target) && segments.length <= 1) permanentRedirect(siteHref(target, language));
  notFound();
});

export const resolveSiteSection = cache(async (section: string, segments: string[], language: SiteLanguage) => {
  const path = [section, ...segments].join("/");
  const isProjectDetail = section === "projects" && segments.length === 2 && segments[0] === "featured-projects";
  const page = sitePage(isProjectDetail ? "projects/featured-projects" : path);
  if (!["applications", "projects", "resources", "about", "contact"].includes(section) || !page) notFound();
  const [content, applicationPage, documentLibraries, projectDetail] = await Promise.all([
    loadSiteHomepage(language),
    section === "applications" && segments.length === 1 ? loadApplicationContent(segments[0], language) : null,
    path === "resources/technical-documents" ? loadTechnicalDocuments(language) : [],
    isProjectDetail ? loadProjectDetail(segments[1], language) : null
  ]);
  if (isProjectDetail && !projectDetail) notFound();
  return { path, page, language, content, applicationPage, documentLibraries, projectDetail };
});
