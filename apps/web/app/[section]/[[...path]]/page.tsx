import type { Metadata } from "next";
import SitePage from "../../../components/site/site-page";
import { localSitePreview, siteLanguage } from "../../../lib/content";
import { resolveSiteSection } from "../../../lib/site-page";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ section: string; path?: string[] }>; searchParams: Promise<{ lang?: string }> };
async function selection({params, searchParams}: Props) {
  const [route, query] = await Promise.all([params, searchParams]);
  return resolveSiteSection(route.section, route.path || [], siteLanguage(query.lang));
}
export async function generateMetadata(props: Props): Promise<Metadata> {
  const {page, language, applicationPage, projectDetail} = await selection(props);
  const article = projectDetail || applicationPage;
  return { title: `${article?.title || page.name[language]} | ZHUDUO`, ...(article?.summary ? { description: article.summary } : {}), ...(localSitePreview() ? { robots: {index:false, follow:false} } : {}) };
}
export default async function SectionPage(props: Props) {
  const {path, content, language, applicationPage, documentLibraries, projectDetail} = await selection(props);
  return <SitePage key={`${language}:${path}`} {...content} projectDetail={projectDetail} applicationPage={applicationPage} documentLibraries={documentLibraries} language={language} view={path.split("/")[0]} path={path} inquiryPreview={localSitePreview()} turnstileSiteKey={localSitePreview() ? "" : process.env.TURNSTILE_SITE_KEY?.trim() || ""}/>;
}
