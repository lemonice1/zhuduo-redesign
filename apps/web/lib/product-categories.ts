import defaults from "@modular/contracts/managed-product-categories.json";

export type ProductCategoryDefinition = {
  key: string; slug: string; division: "electrical" | "modular-buildings";
  group: "none" | "transformers" | "switchgear" | "substations";
  nameEn: string; nameFr: string; nameAr: string; nameZh: string; sortOrder: number; visible: boolean;
};
export const defaultProductCategories = defaults as ProductCategoryDefinition[];
export const categoryPath = (category: ProductCategoryDefinition) => [category.division, ...(category.group === "none" ? [] : [category.group]), category.slug].join("/");
export const categoryNames = (category: ProductCategoryDefinition) => ({ en: category.nameEn, fr: category.nameFr || category.nameEn, ar: category.nameAr || category.nameEn, zh: category.nameZh || category.nameEn });

export function normalizeProductCategories(rows: unknown): ProductCategoryDefinition[] {
  if (!Array.isArray(rows)) throw new Error("Invalid CMS product categories.");
  const keys = new Set(), paths = new Set();
  const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
  return rows.map(row => {
    if (!row || typeof row !== "object") throw new Error("Invalid CMS product category.");
    const result = { key: text(row.key), slug: text(row.slug), division: row.division, group: row.group, nameEn: text(row.nameEn), nameFr: text(row.nameFr), nameAr: text(row.nameAr), nameZh: text(row.nameZh), sortOrder: Number.isSafeInteger(row.sortOrder) ? row.sortOrder : 0, visible: row.visible !== false } as ProductCategoryDefinition;
    if (![result.key, result.slug].every(value => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) || !result.nameEn || !["electrical", "modular-buildings"].includes(result.division) || !["none", "transformers", "switchgear", "substations"].includes(result.group) || result.division === "modular-buildings" && result.group !== "none" || keys.has(result.key) || paths.has(categoryPath(result))) throw new Error("Invalid or duplicate CMS product category.");
    keys.add(result.key); paths.add(categoryPath(result));
    return result;
  }).sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
}
