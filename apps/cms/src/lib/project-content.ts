// Public fields also define the default Operations role's additive permissions.
export const projectFields = ["slug", "title", "location", "application", "summary", "detail", "imageUrl", "sortOrder", "productName", "quantity", "isVerified", "projectFacts", "features", "projectFaqs", "productionText", "productionSteps", "shippingText"];
export const projectMedia = ["image", "gallery", "introImage", "detailImages", "certificateImages", "video", "productionImages", "referenceImages", "shippingImages"];

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
export function publicProjectRows(value: unknown, keys: string[]) {
  if (!Array.isArray(value)) return [];
  return value.flatMap(row => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return [];
    const clean = Object.fromEntries(keys.map(key => [key, text(row[key])]));
    return keys.every(key => clean[key]) ? [clean] : [];
  });
}
