import { redirect } from "next/navigation";
import { catalogueHref } from "../../lib/catalogue";
import { siteLanguage } from "../../lib/content";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const query = await searchParams;
  redirect(catalogueHref(undefined, undefined, siteLanguage(query.lang), "products"));
}
