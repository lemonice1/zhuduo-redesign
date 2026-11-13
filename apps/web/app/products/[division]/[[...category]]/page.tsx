import type { Metadata } from "next";
import SitePage from "../../../../components/site/site-page";
import { localSitePreview, siteLanguage } from "../../../../lib/content";
import { resolveSiteProductPage } from "../../../../lib/site-page";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ division: string; category?: string[] }>; searchParams: Promise<{ lang?: string }> };

async function selection({ params, searchParams }: PageProps) {
  const [route, query] = await Promise.all([params, searchParams]);
  return resolveSiteProductPage(route.division, route.category || [], siteLanguage(query.lang));
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { page, product, language } = await selection(props);
  return { title: `${product?.title || page.name[language]} | ZHUDUO`, description: product?.summary || page.name[language], ...(localSitePreview() ? { robots: { index: false, follow: false } } : {}) };
}

export default async function ProductCataloguePage(props: PageProps) {
  const { path, product, language, content } = await selection(props);
  return <SitePage key={`${language}:${path}:${product?.slug || ""}`} {...content} language={language} view={path.split("/")[0]} path={path} product={product} inquiryPreview={localSitePreview()} turnstileSiteKey={localSitePreview() ? "" : process.env.TURNSTILE_SITE_KEY?.trim() || ""}/>;
}
