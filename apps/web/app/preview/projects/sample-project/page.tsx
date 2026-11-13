import type { Metadata } from "next";
import SitePage from "../../../../components/site/site-page";
import { brochureHomepage, siteLanguage } from "../../../../lib/content";
import { sampleProject } from "../../../../lib/project-sample";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sample project | ZHUDUO", robots: { index: false, follow: false } };
export default async function SampleProjectPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const language = siteLanguage((await searchParams).lang);
  const content = brochureHomepage(language);
  return <SitePage key={language} {...content} projectDetail={sampleProject(language)} language={language} view="projects" path="projects/featured-projects/sample-project" inquiryPreview/>;
}
