import taxonomy from "@modular/contracts/product-taxonomy.json";
import type { Route } from "next";
import type { Product } from "./content";
import type { SiteLanguage } from "./site-language";

export type CatalogueLanguage = SiteLanguage;
export type Bilingual = { zh: string; en: string; ar: string; fr: string };
export type CatalogueCategory = { slug: string; name: Bilingual; image?: string; imageReference?: boolean; legacyProductSlugs?: string[] };
export type CatalogueDivision = { slug: string; name: Bilingual; description: Bilingual; categories: CatalogueCategory[] };
export type CatalogueProduct = { slug: string; category: string; title: string; summary: string; detail: string; image: string; options: string[]; galleryUrls?: string[]; brochureUrl?: string };

export const divisions: CatalogueDivision[] = taxonomy.divisions;
export const categories = divisions.flatMap(division => division.categories);

export function catalogueHref(division?: string, category?: string, language: CatalogueLanguage = "en", anchor?: string, previewRoutes = false): Route {
  const path = division ? `${previewRoutes ? "/preview" : ""}/products/${division}${category ? `/${category}` : ""}` : previewRoutes ? "/preview" : "/";
  return `${path}?lang=${language}${anchor ? `#${anchor}` : ""}` as Route;
}

export function productHref(division: string, category: string, slug: string, language: CatalogueLanguage = "en", previewRoutes = false): Route {
  return `${previewRoutes ? "/preview" : ""}/products/${encodeURIComponent(division)}/${encodeURIComponent(category)}/${encodeURIComponent(slug)}?lang=${language}` as Route;
}

export function productCategory(product: Pick<Product, "slug" | "category" | "categoryKey">): string | undefined {
  // An explicit classification wins. Invalid explicit keys must not be guessed.
  if (product.categoryKey) return categories.find(category => category.slug === product.categoryKey)?.slug;
  return categories.find(category => category.legacyProductSlugs?.includes(product.slug))?.slug
    ?? categories.find(category => Object.values(category.name).some(name => name.toLowerCase() === product.category.trim().toLowerCase()))?.slug;
}

export function catalogueProducts(products: Product[], division: CatalogueDivision): CatalogueProduct[] {
  return products.flatMap(product => {
    const category = productCategory(product);
    if (!category || !division.categories.some(item => item.slug === category)) return [];
    return [{ slug: product.slug, category, title: product.title, summary: product.summary, detail: product.detail, image: product.imageUrl, options: product.options, galleryUrls: product.galleryUrls, brochureUrl: product.brochureUrl }];
  });
}
