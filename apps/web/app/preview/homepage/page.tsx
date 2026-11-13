import SitePage from "../../../components/site/site-page";
import { brochureHomepage, siteLanguage } from "../../../lib/content";

export default async function HomepageDesignPreview({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const language = siteLanguage((await searchParams).lang);
  return <SitePage key={language} previewRoutes language={language} products={brochureHomepage(language).products}/>;
}
