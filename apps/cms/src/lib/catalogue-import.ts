import { createHash } from "node:crypto";

const locales = ["en", "zh-Hans"] as const;
const populate = ["image", "gallery", "brochure"];
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const mediaId = (value: any) => typeof value === "number" ? value : value?.id ?? null;

// Include every editable field and media relation. An unpublished document or
// an edited draft belongs to the administrator, even if its old version is live.
function editorialFingerprint(row: any) {
  return hash({
    slug: row.slug, title: row.title, summary: row.summary, category: row.category,
    categoryKey: row.categoryKey ?? null, detail: row.detail ?? "",
    customizableOptions: row.customizableOptions ?? [], imageUrl: row.imageUrl ?? "",
    sortOrder: row.sortOrder ?? 0, sourceReference: row.sourceReference ?? "",
    image: mediaId(row.image), gallery: (row.gallery ?? []).map(mediaId), brochure: mediaId(row.brochure)
  });
}

function isLegacy(row: any, product: any, locale: string) {
  const original = product?.[locale];
  return Boolean(original && row && row.title === original.title && row.summary === original.summary &&
    row.category === original.category && row.detail === original.detail &&
    JSON.stringify(row.customizableOptions) === JSON.stringify(original.options) &&
    row.imageUrl === product.imageUrl && !row.image && !row.gallery?.length && !row.brochure &&
    !row.sourceReference && !row.catalogueImportState &&
    (!row.categoryKey || row.categoryKey === (product.categoryKey || (product.slug === "space-capsule-d7" ? "space-capsules" : "expandable-homes"))));
}

export async function importCompanyCatalogue(strapi: any, catalogue: any, options: {
  apply?: boolean;
  uploadAsset: (key: string, title: string) => Promise<number>;
}) {
  const documents = strapi.documents("api::product.product");
  const results: { slug: string; action: string; documentId?: string }[] = [];
  const cache = new Map<string, number>();
  const manifestHash = (product: any) => hash({ product,
    media: [product.imageUrl, ...(product.galleryUrls ?? [])].map(key => catalogue.assets?.[key]?.sha256 ?? key),
    brochure: product.brochureKey ? catalogue.brochures[product.brochureKey].sha256 : null
  });
  const upload = async (key: string, title: string) => {
    if (!cache.has(key)) cache.set(key, await options.uploadAsset(key, title));
    return cache.get(key)!;
  };
  const inspect = async (product: any) => {
    // A transaction uses one pg client; do not queue concurrent queries on it.
    const rows = [];
    for (const locale of locales) rows.push({
      locale,
      draft: await documents.findFirst({ filters: { slug: product.slug }, locale, status: "draft", populate }),
      live: await documents.findFirst({ filters: { slug: product.slug }, locale, status: "published", populate })
    });
    const ids = new Set(rows.flatMap(row => [row.draft?.documentId, row.live?.documentId]).filter(Boolean));
    if (!ids.size) return { action: "create", rows, documentId: undefined };
    const documentId = [...ids][0] as string;
    if (ids.size !== 1) return { action: "preserved", rows, documentId };
    const original = catalogue.legacyProducts?.find((item: any) => item.slug === product.slug);
    let unchanged = true;
    const sourceHash = manifestHash(product);
    for (const { locale, draft, live } of rows) {
      // Never publish an editorial draft or restore an intentionally unpublished locale.
      if (!draft || !live) return { action: "preserved", rows, documentId };
      const state = draft.catalogueImportState;
      if (state?.fingerprint === editorialFingerprint(draft) && state.fingerprint === editorialFingerprint(live)) {
        if (state.manifestHash !== sourceHash) unchanged = false;
      } else if ((isLegacy(draft, original, locale) && isLegacy(live, original, locale)) ||
                 (isLegacy(draft, product, locale) && isLegacy(live, product, locale))) unchanged = false;
      else return { action: "preserved", rows, documentId };
    }
    return { action: unchanged ? "unchanged" : "update", rows, documentId };
  };

  for (const [index, product] of catalogue.products.entries()) {
    const plan = await inspect(product);
    if (!options.apply || ["preserved", "unchanged"].includes(plan.action)) {
      results.push({ slug: product.slug, action: plan.action, documentId: plan.documentId }); continue;
    }
    const image = await upload(product.imageUrl, product.en.title);
    const gallery = [];
    for (const url of product.galleryUrls ?? []) gallery.push(await upload(url, product.en.title));
    const brochure = product.brochureKey ? await upload(catalogue.brochures[product.brochureKey].path, catalogue.brochures[product.brochureKey].name) : null;
    await strapi.db.transaction(async () => {
      const current = await inspect(product);
      if (current.action !== plan.action || current.documentId !== plan.documentId ||
          hash(current.rows) !== hash(plan.rows)) throw new Error(`Product changed during import: ${product.slug}. Rerun to review.`);
      let documentId = plan.documentId;
      for (const locale of locales) {
        const copy = product[locale];
        const data = {
          slug: product.slug, title: copy.title, summary: copy.summary, category: copy.category,
          categoryKey: product.categoryKey, detail: copy.detail, customizableOptions: copy.options,
          image, gallery: [...new Set(gallery)].filter(id => id !== image), brochure, imageUrl: "", sortOrder: plan.rows[0]?.draft?.sortOrder ?? index,
          sourceReference: JSON.stringify(product.source)
        };
        const row = documentId ? await documents.update({ documentId, locale, data, populate }) :
          await documents.create({ locale, data, populate });
        documentId = row.documentId;
      }
      // Shared media fields are synchronized by i18n; fingerprint only after
      // both translations exist, then publish the same document in each locale.
      for (const locale of locales) {
        const row = await documents.findOne({ documentId, locale, status: "draft", populate });
        await documents.update({ documentId, locale, data: { catalogueImportState: {
          fingerprint: editorialFingerprint(row), manifestHash: manifestHash(product)
        } } });
        await documents.publish({ documentId, locale });
      }
      results.push({ slug: product.slug, action: plan.action, documentId });
    });
  }
  return results;
}
