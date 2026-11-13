import { divisions, productCategory, type CatalogueLanguage } from "./catalogue";
import type { Product } from "./content";
import { translate } from "./site-language";

export type InquiryDirection = { value: string; title: string; division?: string };
export type InquiryDirectionGroup = { value: string; title: string; categories: InquiryDirection[]; models: InquiryDirection[] };

export function inquiryDirectionGroups(products: Product[], directions: InquiryDirection[], language: CatalogueLanguage): InquiryDirectionGroup[] {
  const models = [...new Map(products.map(product => [product.slug, product])).values()];
  const modelKeys = new Set(models.map(product => product.slug));
  const categories = [...new Map(directions.filter(direction => !modelKeys.has(direction.value)).map(direction => [direction.value, direction])).values()];
  const divisionForCategory = new Map(divisions.flatMap(division => division.categories.map(category => [category.slug, division.slug] as const)));
  for (const category of categories) if (category.division) divisionForCategory.set(category.value, category.division);
  const divisionForModel = new Map(models.map(product => [product.slug, divisionForCategory.get(product.categoryKey || productCategory(product) || "")]));
  const groups: InquiryDirectionGroup[] = divisions.map(division => ({
    value: division.slug,
    title: division.name[language],
    categories: categories.filter(category => divisionForCategory.get(category.value) === division.slug),
    models: models.filter(product => divisionForModel.get(product.slug) === division.slug).map(product => ({ value: product.slug, title: product.title }))
  }));
  // Older CMS products remain selectable until an editor classifies them.
  groups.push({
    value: "other",
    title: translate(language, "Other products"),
    categories: categories.filter(category => !divisionForCategory.has(category.value)),
    models: models.filter(product => !divisionForModel.get(product.slug)).map(product => ({ value: product.slug, title: product.title }))
  });
  return groups.filter(group => group.categories.length || group.models.length);
}
