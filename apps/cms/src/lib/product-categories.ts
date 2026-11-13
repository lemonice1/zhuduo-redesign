import defaults from "@modular/contracts/managed-product-categories.json";
import taxonomy from "@modular/contracts/product-taxonomy.json";
import { errors } from "@strapi/utils";

const uid = "api::product-category.product-category";
const categoryLock = 93651244;
export const productCategoryFields = ["key", "slug", "division", "group", "nameEn", "nameFr", "nameAr", "nameZh", "sortOrder", "visible"];
export const productCategoryAdminFields = productCategoryFields.filter(field => field !== "key");

export function canonicalCategoryKey(product: { slug?: string; categoryKey?: string; category?: string }) {
  const key = product.categoryKey || (taxonomy.divisions as { categories: { slug: string; name: Record<string, string>; legacyProductSlugs?: string[] }[] }[]).flatMap(division => division.categories).find(category =>
    (category as any).legacyProductSlugs?.includes(product.slug) || Object.values(category.name).some(name => name.toLowerCase() === product.category?.trim().toLowerCase()))?.slug;
  if (key === "substations") return product.slug === "substation-prefabricated" ? "prefabricated-substations" : "compact-substations";
  if (key === "mv-distribution") return "mv-switchgear";
  if (key === "lv-distribution") return "lv-switchgear";
  if (key === "distribution-transformers" && /^scb/i.test(product.slug || "")) return "dry-type-transformers";
  return key;
}

function validateCategory(data: any) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug || "")) throw new errors.ValidationError("分类网址标识只能包含小写英文字母、数字和短横线。");
  if (!["modular-buildings", "electrical"].includes(data.division)) throw new errors.ValidationError("请选择所属大类：房屋或电气设备。");
  if (!["none", "transformers", "switchgear", "substations"].includes(data.group)) throw new errors.ValidationError("请选择有效的菜单分组。");
  if (data.division === "modular-buildings" && data.group !== "none") throw new errors.ValidationError("房屋分类的菜单分组请选择“不分组”。");
  if (data.division === "electrical" && data.group === "none" && ["transformers", "switchgear", "substations"].includes(data.slug)) throw new errors.ValidationError("这个网址标识已用于电气设备分组，请使用其他标识。");
}

export function registerProductCategories(strapi: any) {
  if (!strapi.documents?.use) return;
  strapi.documents.use(async (context: any, next: () => Promise<any>) => {
    const categoryAction = context.uid === uid && ["create", "clone", "update", "publish", "delete", "unpublish"].includes(context.action);
    const productAction = context.uid === "api::product.product" && ["create", "clone", "update", "publish"].includes(context.action);
    if (!categoryAction && !productAction) return next();
    return strapi.db.transaction(async ({ trx }: any) => {
      // Serialize category removal with product assignment, including writes in other locales.
      if (trx) await strapi.db.connection.raw("SELECT pg_advisory_xact_lock(?)", [categoryLock]).transacting(trx);
      if (productAction) {
        const old = context.params.documentId ? await strapi.documents(context.uid).findOne({ documentId: context.params.documentId, locale: context.params.locale, status: "draft" }) : null;
        const product = { ...old, ...context.params.data };
        const key = canonicalCategoryKey(product);
        // Retain untouched historical/unclassified products. New assignments use a published category.
        if (key && (["publish", "clone"].includes(context.action) || !old || product.categoryKey !== old.categoryKey)) {
          const category = await strapi.documents(uid).findFirst({ filters: { key }, status: "published" });
          if (!category) throw new errors.ValidationError("所选分类尚未发布或已删除，请先在“产品分类”中发布分类，再保存或发布产品。");
        }
        return next();
      }
      const documents = strapi.documents(uid);
      const old = context.params.documentId ? await documents.findOne({ documentId: context.params.documentId, status: "draft" }) : null;
      if (["delete", "unpublish"].includes(context.action) && old) {
        const products = await strapi.db.query("api::product.product").findMany({ select: ["slug", "category", "categoryKey"] });
        if (products.some(product => canonicalCategoryKey(product) === old.key)) throw new errors.ValidationError("此分类仍有关联产品（包括其他语言和草稿），请先将产品迁移到其他分类。只想收起菜单时，可关闭“在菜单中显示”后发布。");
      }
      if (["create", "clone", "update", "publish"].includes(context.action)) {
        const data = { group: "none", ...old, ...context.params.data };
        validateCategory(data);
        if (old && context.action !== "clone" && ["slug", "division", "group"].some(field => old[field] !== data[field])) throw new errors.ValidationError("已保存分类的网址标识、所属大类和分组固定，以保留现有链接。需要调整位置时，请新增分类并迁移产品。");
        if (context.params.data) context.params.data.key = (context.action !== "clone" && old?.key) || defaults.find(row => row.slug === data.slug && row.division === data.division && row.group === data.group)?.key || data.slug;
      }
      return next();
    });
  });
}

export async function seedProductCategories(strapi: any) {
  if (!strapi.contentTypes?.[uid]) return;
  const store = strapi.store({ type: "core", name: "product-categories" });
  if (await store.get({ key: "defaults-v1" })) return;
  await strapi.db.transaction(async ({ trx }: any) => {
    if (trx) await strapi.db.connection.raw("SELECT pg_advisory_xact_lock(?)", [categoryLock]).transacting(trx);
    if (await store.get({ key: "defaults-v1" })) return;
    const documents = strapi.documents(uid);
    for (const data of defaults) {
      const existing = await documents.findFirst({ filters: { key: data.key }, status: "draft" });
      if (!existing) await documents.create({ data, status: "published" });
    }
    // Permanent marker: intentional deletions/unpublishing must not reappear after restart.
    await store.set({ key: "defaults-v1", value: true });
  });
}
