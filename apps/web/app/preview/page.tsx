import HomePage from "../../components/home-page";
import { brochureHomepage, siteLanguage } from "../../lib/content";

export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const query = await searchParams;
  const language = siteLanguage(query.lang);
  const content = brochureHomepage(language);
  return <div className="catalogue-site site-preview pv-original-home"><HomePage key={language} {...content} language={language} previewRoutes inquiryPreview/></div>;
}
