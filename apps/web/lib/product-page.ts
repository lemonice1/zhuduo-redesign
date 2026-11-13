import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";
import { divisions, productCategory } from "./catalogue";
import { brochureHomepage, loadSiteHomepage } from "./content";
import type { SiteLanguage } from "./site-language";

// Both the metadata and page resolve the same published, localized catalogue.
export const resolveProductPage = cache(async (divisionSlug: string, path: string, language: SiteLanguage, previewRoutes = false) => {
  const segments = path ? path.split("/") : [];
  const division = divisions.find(item => item.slug === divisionSlug);
  const category = division?.categories.find(item => item.slug === segments[0]);
  if (!division || segments.length > 2 || (segments.length && !category)) notFound();

  const content = previewRoutes ? brochureHomepage(language) : await loadSiteHomepage(language);
  const product = segments.length === 2 ? content.products.find(item => item.slug === segments[1] && productCategory(item) === category!.slug) : undefined;
  if (segments.length === 2 && !product) notFound();
  return { division, category, product, language, content };
});
