import "server-only";

import { cache } from "react";
import { brochureHomepage, loadSiteHomepage } from "./content";
import { loadProjectDetail } from "./project-content";
import type { ProjectDetail } from "./project-detail";
import type { SiteLanguage } from "./site-language";
import australia from "../../../docs/content/australia-40ft-project.json";
import { previewProjectSlug } from "./whiteboard-preview-routes";

// This snapshot belongs only to the design preview. Public routes still require
// published CMS content; a CMS outage never changes their behavior.
function projectSnapshot(language: SiteLanguage): ProjectDetail {
  const text = australia.locales[language];
  const image = (file: string, caption: string) => ({ url: `/projects/design-preview/${file}.webp`, alt: caption, caption });
  const cover = image("australia-project-cover", "Australia · supplied project photograph");
  const exterior = image("expandable-40ft-exterior", "40ft expandable house · product reference");
  const interior = image("expandable-40ft-interior", "Interior · product reference");
  return {
    slug: australia.slug, ...text, gallery: [cover, exterior, interior], introImage: exterior,
    detailImages: [interior], certificateImages: [], videoUrl: "",
    productionImages: ["frame", "assembly", "finishing"].map((step, index) => image(`expandable-production-${step}`, text.productionSteps[index])),
    referenceImages: [], shippingImages: ["loading", "transport"].map(step => image(`expandable-container-${step}`, "Loading and transportation · reference")),
    // The actual project FAQ was subsequently removed by the owner.
    projectFaqs: [], mediaBaseUrl: "https://bjzdbuilding.com/"
  };
}

export const loadWhiteboardPreview = cache(async (language: SiteLanguage) => {
  const [contentResult, projectResult] = await Promise.allSettled([
    loadSiteHomepage(language), loadProjectDetail(previewProjectSlug, language)
  ]);
  return {
    content: contentResult.status === "fulfilled" ? contentResult.value : brochureHomepage(language),
    project: projectResult.status === "fulfilled" && projectResult.value ? projectResult.value : projectSnapshot(language)
  };
});
