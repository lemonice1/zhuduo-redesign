import SitePage from "../components/site/site-page";
import { loadSiteHomepage, localSitePreview, siteLanguage } from "../lib/content";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { lang } = await searchParams;
  const language = siteLanguage(lang);
  const content = await loadSiteHomepage(language);
  // Unpublished translations stay empty. Never silently substitute demo or a different locale.
  return <SitePage key={language} {...content} language={language} inquiryPreview={localSitePreview()} turnstileSiteKey={localSitePreview() ? "" : process.env.TURNSTILE_SITE_KEY?.trim() || ""}/>;
}
