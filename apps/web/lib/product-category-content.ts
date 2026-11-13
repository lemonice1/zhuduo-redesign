import "server-only";
import { normalizeProductCategories, type ProductCategoryDefinition } from "./product-categories";

export async function loadProductCategories(): Promise<ProductCategoryDefinition[] | undefined> {
  const cmsUrl = process.env.STRAPI_PUBLIC_URL;
  if (!cmsUrl && process.env.NODE_ENV === "development") return undefined;
  if (!cmsUrl) throw new Error("STRAPI_PUBLIC_URL is required.");
  const rows = [];
  let page = 1, pageCount = 1;
  do {
    const response = await fetch(`${cmsUrl.replace(/\/$/, "")}/api/product-categories?pagination[page]=${page}&pagination[pageSize]=100`, { next: { revalidate: 30 }, signal: AbortSignal.timeout(10_000) });
    // Web may be rolled out before the additive CMS model. Only a missing endpoint uses the old taxonomy.
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error("CMS product categories are unavailable.");
    const body = await response.json();
    const pagination = body?.meta?.pagination;
    if (!Array.isArray(body?.data) || pagination?.page !== page || pagination.pageSize !== 100 || !Number.isSafeInteger(pagination.pageCount) || pagination.pageCount < 0 || pagination.pageCount > 1000) throw new Error("Invalid CMS category pagination.");
    rows.push(...body.data); pageCount = pagination.pageCount; page++;
  } while (page <= pageCount);
  return normalizeProductCategories(rows);
}
