import type { Metadata } from "next";
import CatalogueView from "../../../../../components/catalogue/catalogue-view";
import ProductDetailPage from "../../../../../components/catalogue/product-detail-page";
import { siteLanguage } from "../../../../../lib/content";
import { resolveProductPage } from "../../../../../lib/product-page";

type PageProps = {
  params: Promise<{ division: string; category?: string[] }>;
  searchParams: Promise<{ lang?: string }>;
};

async function selection({ params, searchParams }: PageProps) {
  const [route, query] = await Promise.all([params, searchParams]);
  return resolveProductPage(route.division, route.category?.join("/") || "", siteLanguage(query.lang), true);
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { division, category, product, language } = await selection(props);
  return { title: `${product?.title || category?.name[language] || division.name[language]} | ZhuDuo`, description: product?.summary || division.description[language], robots: { index: false, follow: false } };
}

export default async function PreviewCataloguePage(props: PageProps) {
  const { division, category, product, language, content } = await selection(props);
  const shared = { division, language, products: content.products, settings: content.settings, previewRoutes: true, inquiryPreview: true, turnstileSiteKey: "" };
  return product ? <ProductDetailPage key={`${language}:${product.slug}`} {...shared} category={category!} product={product}/> : <CatalogueView {...shared}/>;
}
