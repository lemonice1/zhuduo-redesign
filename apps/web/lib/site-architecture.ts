import type { Route } from "next";
import { categories, productCategory, divisions, type CatalogueDivision } from "./catalogue";
import { categoryPath, categoryNames, defaultProductCategories, type ProductCategoryDefinition } from "./product-categories";
import type { Product } from "./content";
import type { SiteLanguage } from "./site-language";

export type SiteNode = {
  slug: string;
  name: Record<SiteLanguage, string>;
  children?: SiteNode[];
};
const node = (slug: string, en: string, ar: string, fr: string, children?: SiteNode[]): SiteNode => ({ slug, name: { en, ar, fr }, ...(children ? { children } : {}) });

const homePage = node("", "Home", "الرئيسية", "Accueil");

// The logo links home; the main menu starts with the two product collections.
export const siteNavigation: SiteNode[] = [
  node("electrical", "Electrical Equipment", "المعدات الكهربائية", "Équipements électriques", [
    node("transformers", "Transformers", "المحولات", "Transformateurs", [
      node("power-transformers", "Power Transformers", "محولات القدرة", "Transformateurs de puissance"),
      node("distribution-transformers", "Distribution Transformers", "محولات التوزيع", "Transformateurs de distribution"),
      node("dry-type-transformers", "Dry-Type Transformers", "المحولات الجافة", "Transformateurs secs"),
      node("special-transformers", "Special Transformers", "المحولات الخاصة", "Transformateurs spéciaux")
    ]),
    node("switchgear", "Switchgear", "لوحات التوزيع", "Appareillage", [
      node("mv-switchgear", "MV Switchgear", "لوحات الجهد المتوسط", "Appareillage moyenne tension"),
      node("lv-switchgear", "LV Switchgear", "لوحات الجهد المنخفض", "Appareillage basse tension")
    ]),
    node("substations", "Substations", "محطات التحويل", "Postes de transformation", [
      node("compact-substations", "Compact Substations", "محطات التحويل المدمجة", "Postes compacts"),
      node("prefabricated-substations", "Prefabricated Substations", "محطات التحويل مسبقة الصنع", "Postes préfabriqués")
    ])
  ]),
  node("modular-buildings", "Modular Buildings", "المباني المعيارية", "Bâtiments modulaires", [
    node("expandable-houses", "Expandable Houses", "المنازل القابلة للتوسعة", "Maisons extensibles"),
    node("folding-houses", "Folding Houses", "المنازل القابلة للطي", "Maisons pliables"),
    node("flat-pack-buildings", "Flat Pack Buildings", "المباني المسطحة التعبئة", "Bâtiments en kit"),
    node("detachable-houses", "Detachable Houses", "المنازل القابلة للفك", "Maisons démontables"),
    node("steel-structure-buildings", "Steel Structure Buildings", "المباني ذات الهياكل الفولاذية", "Bâtiments à structure métallique"),
    node("space-capsules", "Space Capsules", "الكبسولات السكنية", "Capsules habitables"),
    node("apple-cabins", "Apple Cabins", "كبائن آبل", "Cabines Apple")
  ]),
  node("applications", "Applications", "التطبيقات", "Applications", [
    node("energy-utilities", "Energy & Utilities", "الطاقة والمرافق", "Énergie et services publics"),
    node("industrial-projects", "Industrial Projects", "المشاريع الصناعية", "Projets industriels"),
    node("residential-hospitality", "Residential & Hospitality", "السكن والضيافة", "Résidentiel et hôtellerie"),
    node("commercial-temporary-buildings", "Commercial & Temporary Buildings", "المباني التجارية والمؤقتة", "Bâtiments commerciaux et temporaires")
  ]),
  node("projects", "Projects", "المشاريع", "Projets", [
    node("featured-projects", "Featured Projects", "مشاريع مختارة", "Projets à la une")
  ]),
  node("resources", "Resources", "الموارد", "Ressources", [
    node("product-catalogues", "Product Catalogues", "كتالوجات المنتجات", "Catalogues produits"),
    node("technical-documents", "Technical Documents", "المستندات الفنية", "Documents techniques"),
    node("faqs", "FAQs", "الأسئلة الشائعة", "Questions fréquentes")
  ]),
  node("about", "About Us", "من نحن", "À propos"),
  node("contact", "Contact", "التواصل", "Contact")
];

export function siteHref(path: string, language: SiteLanguage, previewRoutes = false): Route {
  const prefix = previewRoutes ? "/preview/homepage" : /^(electrical|modular-buildings)(\/|$)/.test(path) ? "/products" : "";
  return `${prefix}${path ? `/${path}` : prefix ? "" : "/"}?lang=${language}` as Route;
}
export function siteProductHref(product: Product, language: SiteLanguage, previewRoutes = false): Route {
  const category = siteProductCategoryPath(product);
  if (!category) return siteHref("contact", language, previewRoutes);
  return siteHref(previewRoutes ? `product/${encodeURIComponent(product.slug)}` : `${category}/${encodeURIComponent(product.slug)}`, language, previewRoutes);
}

export function sitePages(nodes = [homePage, ...siteNavigation], prefix = ""): { path: string; node: SiteNode }[] {
  return nodes.flatMap(item => {
    const path = [prefix, item.slug].filter(Boolean).join("/");
    return [{ path, node: item }, ...sitePages(item.children || [], path)];
  });
}
// Solar products keep a working collection without adding an eighth housing menu item.
export const sitePage = (path: string): SiteNode | undefined => sitePages().find(page => page.path === path)?.node
  ?? (path === "modular-buildings/solar-homes" ? categories.find(category => category.slug === "solar-homes") : undefined);

const housingKeys: Record<string, string> = {
  "expandable-houses": "expandable-homes", "folding-houses": "folding-homes", "flat-pack-buildings": "flat-pack-homes",
  "detachable-houses": "detachable-homes", "steel-structure-buildings": "steel-structures", "space-capsules": "space-capsules", "apple-cabins": "apple-cabins"
};

export function siteProducts(path: string, products: Product[]): Product[] {
  return products.filter(product => { const category = siteProductCategoryPath(product); return category === path || category.startsWith(`${path}/`); });
}

export function siteProductCategoryPath(product: Product): string {
  const key = productCategory(product);
  if (["dry-type-transformers", "special-transformers"].includes(key || "")) return `electrical/transformers/${key}`;
  if (["compact-substations", "prefabricated-substations"].includes(key || "")) return `electrical/substations/${key}`;
  if (["mv-switchgear", "lv-switchgear"].includes(key || "")) return `electrical/switchgear/${key}`;
  if (key === "substations") return `electrical/substations/${product.slug === "substation-prefabricated" ? "prefabricated-substations" : "compact-substations"}`;
  if (key === "power-transformers" || key === "distribution-transformers") return `electrical/transformers/${key === "distribution-transformers" && /^scb/i.test(product.slug) ? "dry-type-transformers" : key}`;
  if (key === "mv-distribution" || key === "lv-distribution") return `electrical/switchgear/${key === "mv-distribution" ? "mv" : "lv"}-switchgear`;
  const slug = Object.entries(housingKeys).find(([, value]) => value === key)?.[0];
  return slug ? `modular-buildings/${slug}` : key === "solar-homes" ? "modular-buildings/solar-homes" : "";
}

export function legacyCategoryPath(division: string, key?: string): string | undefined {
  if (division !== "electrical" && division !== "modular-housing") return undefined;
  if (!key) return division === "electrical" ? division : "modular-buildings";
  if (division === "modular-housing") { const slug = Object.entries(housingKeys).find(([, value]) => value === key)?.[0]; return slug ? `modular-buildings/${slug}` : key === "solar-homes" ? "modular-buildings/solar-homes" : undefined; }
  if (["power-transformers", "distribution-transformers", "dry-type-transformers", "special-transformers"].includes(key)) return `electrical/transformers/${key}`;
  if (key === "substations") return "electrical/substations";
  if (["compact-substations", "prefabricated-substations"].includes(key)) return `electrical/substations/${key}`;
  if (["mv-distribution", "lv-distribution", "mv-switchgear", "lv-switchgear"].includes(key)) return `electrical/switchgear/${key.startsWith("mv") ? "mv" : "lv"}-switchgear`;
}

export const siteInquiryDirections = (language: SiteLanguage) => sitePages().filter(({path, node}) => !node.children && /^(electrical|modular-buildings)\//.test(path)).map(({path, node}) => ({value: housingKeys[node.slug] || node.slug, title: node.name[language]}));

export function createSiteArchitecture(records?: ProductCategoryDefinition[]) {
  if (!records) return { navigation: siteNavigation, page: sitePage, productCategory, categoryPath: siteProductCategoryPath, productHref: siteProductHref, products: siteProducts, directions: siteInquiryDirections, divisions };
  const sorted = [...records].sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
  function productKey(product: Product) {
    const legacyPath = siteProductCategoryPath(product);
    const key = defaultProductCategories.find(row => categoryPath(row) === legacyPath)?.key || product.categoryKey;
    return sorted.find(row => row.key === key)?.key;
  }
  const productPath = (product: Product) => { const row = sorted.find(row => row.key === productKey(product)); return row ? categoryPath(row) : ""; };
  const navigation = siteNavigation.map(division => {
    if (!["electrical", "modular-buildings"].includes(division.slug)) return division;
    const children: SiteNode[] = [];
    for (const row of sorted.filter(row => row.division === division.slug && row.visible)) {
      const leaf = { slug: row.slug, name: categoryNames(row) };
      if (row.group === "none") children.push(leaf);
      else {
        let group = children.find(child => child.slug === row.group);
        if (!group) {
          const original = division.children?.find(child => child.slug === row.group);
          group = { slug: row.group, name: original!.name, children: [] }; children.push(group);
        }
        group.children!.push(leaf);
      }
    }
    return { ...division, children };
  });
  const pages = sitePages([homePage, ...navigation]);
  // Hidden categories retain working published URLs and product details, including the legacy solar collection.
  for (const row of sorted) {
    const path = categoryPath(row);
    if (!pages.some(page => page.path === path)) pages.push({ path, node: { slug: row.slug, name: categoryNames(row) } });
    if (row.group !== "none") {
      const parentPath = `${row.division}/${row.group}`;
      if (!pages.some(page => page.path === parentPath)) pages.push({ path: parentPath, node: sitePage(parentPath)! });
    }
  }
  const catalogueDivisions: CatalogueDivision[] = divisions.map(division => ({ ...division, categories: sorted.filter(row => row.division === (division.slug === "electrical" ? "electrical" : "modular-buildings")).map(row => ({ ...categories.find(category => category.slug === row.key), slug: row.key, name: categoryNames(row) })) }));
  return {
    navigation,
    page: (path: string) => pages.find(page => page.path === path)?.node,
    productCategory: productKey,
    categoryPath: productPath,
    productHref: (product: Product, language: SiteLanguage, previewRoutes = false) => { const path = productPath(product); return siteHref(path ? previewRoutes ? `product/${encodeURIComponent(product.slug)}` : `${path}/${encodeURIComponent(product.slug)}` : "contact", language, previewRoutes); },
    products: (path: string, products: Product[]) => products.filter(product => { const category = productPath(product); return category && (category === path || category.startsWith(`${path}/`)); }),
    directions: (language: SiteLanguage) => sorted.filter(row => row.visible).map(row => ({ value: row.key, title: categoryNames(row)[language], division: row.division === "electrical" ? "electrical" : "modular-housing" })),
    divisions: catalogueDivisions
  };
}

export function siteApplicationProducts(application: string, products: Product[]): Product[] {
  const preferred: Record<string, string[]> = {
    "energy-utilities": ["power-110kv-10000kva", "substation-yb", "oil-10kv-1000kva"],
    "industrial-projects": ["scb10-10kv-250kva", "substation-prefabricated", "substation-zgs11"],
    "residential-hospitality": ["expandable-20ft", "space-capsule-d7", "apple-cabin-ac01"],
    "commercial-temporary-buildings": ["flat-pack-house", "detachable-house", "folding-house-z"]
  };
  if (!preferred[application]) return [];
  const collection = siteProducts(["energy-utilities", "industrial-projects"].includes(application) ? "electrical" : "modular-buildings", products);
  return [...new Map([...preferred[application].flatMap(slug => collection.filter(item => item.slug === slug)), ...collection].map(item => [item.slug, item])).values()].slice(0, 3);
}

export function siteApplicationImage(application: string, products: Product[]): string {
  return siteApplicationProducts(application, products).find(product => product.imageUrl)?.imageUrl
    || (["energy-utilities", "industrial-projects"].includes(application) ? "/brand/hero-transformer-clean.webp" : application === "residential-hospitality" ? "/products/company/d7-exterior-setting.webp" : "/products/company/flat-pack-house.webp");
}

export const architectureCopy = {
  en: {
    collection: "Find the right starting point.", collectionNote: "Browse the product families, compare available models and tell us what your project needs.",
    search: "Search products", count: "products", all: "All products", empty: "Product information in preparation", emptyNote: "Contact our team for available models and specifications in this category.",
    request: "Discuss your requirements", next: "Next", previous: "Previous", clear: "Clear search", noResults: "No matching products. Try another model or category.",
    resourcesNote: "Product information, technical references and answers for planning your next project.", cataloguesNote: "Browse the available product documents or explore the models online.",
    technicalNote: "Review model specifications on each product page. Ask our team about drawings and project-specific documents.", documentPending: "No document published yet", requestDocument: "Request a document", online: "Browse online", specifications: "View specifications",
    applicationNote: "Start with your application, then review the relevant product lines and discuss the required configuration.", needs: "Plan your project", needsNote: "Share the destination, quantity, site conditions and any drawings or technical requirements. Final product suitability and specifications are confirmed for each project.",
    relevant: "Products to explore", category: "Product families", contactTitle: "Tell us what you are planning.", contactNote: "Choose a product and share a few details to start your quotation request.",
    faq3: "Where can I find product documents?", answer3: "Specifications are available on product pages. Verified PDF catalogues and technical documents will appear in Resources; request other documents with your inquiry.",
    faq4: "Which details are confirmed for my order?", answer4: "Dimensions, configuration, applicable standards, delivery terms and pricing are confirmed in the agreed project specification and quotation."
  },
  fr: {
    collection: "Trouvez votre point de départ.", collectionNote: "Parcourez les familles de produits, comparez les modèles et présentez les besoins de votre projet.",
    search: "Rechercher un produit", count: "produits", all: "Tous les produits", empty: "Informations produit en préparation", emptyNote: "Contactez notre équipe pour les modèles et caractéristiques disponibles dans cette catégorie.",
    request: "Présenter vos besoins", next: "Suivant", previous: "Précédent", clear: "Effacer la recherche", noResults: "Aucun produit trouvé. Essayez un autre modèle ou une autre catégorie.",
    resourcesNote: "Informations produits, références techniques et réponses pour préparer votre projet.", cataloguesNote: "Consultez les documents produits disponibles ou explorez les modèles en ligne.",
    technicalNote: "Consultez les caractéristiques sur chaque fiche produit. Demandez les plans et documents propres à votre projet.", documentPending: "Aucun document publié pour le moment", requestDocument: "Demander un document", online: "Consulter en ligne", specifications: "Voir les caractéristiques",
    applicationNote: "Partez de votre application, puis examinez les gammes adaptées et discutez de la configuration requise.", needs: "Préparez votre projet", needsNote: "Précisez la destination, la quantité, les conditions du site et vos plans ou exigences techniques. L’adéquation et les caractéristiques sont confirmées pour chaque projet.",
    relevant: "Produits à explorer", category: "Familles de produits", contactTitle: "Présentez-nous votre projet.", contactNote: "Choisissez un produit et partagez quelques détails pour demander un devis.",
    faq3: "Où trouver les documents produits ?", answer3: "Les caractéristiques figurent sur les fiches produits. Les PDF vérifiés seront publiés dans Ressources ; précisez les autres documents souhaités dans votre demande.",
    faq4: "Quels détails sont confirmés pour ma commande ?", answer4: "Les dimensions, la configuration, les normes, les conditions de livraison et les prix sont confirmés dans les spécifications et le devis convenus."
  },
  ar: {
    collection: "اعثر على نقطة البداية المناسبة.", collectionNote: "تصفح فئات المنتجات وقارن الطرازات المتاحة وأخبرنا باحتياجات مشروعك.",
    search: "البحث عن المنتجات", count: "منتج", all: "جميع المنتجات", empty: "معلومات المنتج قيد الإعداد", emptyNote: "تواصل مع فريقنا لمعرفة الطرازات والمواصفات المتاحة ضمن هذه الفئة.",
    request: "ناقش متطلباتك", next: "التالي", previous: "السابق", clear: "مسح البحث", noResults: "لا توجد منتجات مطابقة. جرب طرازاً أو فئة أخرى.",
    resourcesNote: "معلومات المنتجات والمراجع الفنية والإجابات اللازمة للتخطيط لمشروعك القادم.", cataloguesNote: "تصفح مستندات المنتجات المتاحة أو استعرض الطرازات عبر الموقع.",
    technicalNote: "راجع المواصفات في صفحة كل منتج. اطلب الرسومات والمستندات الخاصة بمشروعك من فريقنا.", documentPending: "لا توجد مستندات منشورة بعد", requestDocument: "طلب مستند", online: "تصفح عبر الموقع", specifications: "عرض المواصفات",
    applicationNote: "ابدأ باختيار التطبيق ثم استعرض فئات المنتجات ذات الصلة وناقش التكوين المطلوب.", needs: "خطط لمشروعك", needsNote: "شارك الوجهة والكمية وظروف الموقع والرسومات أو المتطلبات الفنية. يتم تأكيد ملاءمة المنتج ومواصفاته لكل مشروع.",
    relevant: "منتجات للاستكشاف", category: "فئات المنتجات", contactTitle: "أخبرنا عن خططك.", contactNote: "اختر منتجاً وشارك بعض التفاصيل لبدء طلب عرض السعر.",
    faq3: "أين أجد مستندات المنتجات؟", answer3: "تتوفر المواصفات في صفحات المنتجات. ستظهر ملفات PDF المعتمدة في قسم الموارد؛ ويمكن طلب المستندات الأخرى مع استفسارك.",
    faq4: "ما التفاصيل التي يتم تأكيدها لطلبي؟", answer4: "يتم تأكيد الأبعاد والتكوين والمعايير وشروط التسليم والأسعار في المواصفات وعرض السعر المتفق عليهما."
  }
};
