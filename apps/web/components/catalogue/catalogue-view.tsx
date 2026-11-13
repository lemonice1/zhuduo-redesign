"use client";

import LocalizedText from "../localized-text";

import { translate } from "../../lib/site-language";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { divisions, catalogueHref, catalogueProducts, productHref, type CatalogueDivision, type CatalogueLanguage } from "../../lib/catalogue";
import CatalogueShell from "./catalogue-shell";
import type { HomepageContent, Product } from "../../lib/content";
import CatalogueCategoryLink from "./catalogue-category-link";

export default function CatalogueView({ division, language, products: sourceProducts, settings = null, previewRoutes = false, inquiryPreview = false, turnstileSiteKey = "" }: { division: CatalogueDivision; language: CatalogueLanguage; products: Product[]; settings?: HomepageContent["settings"]; previewRoutes?: boolean; inquiryPreview?: boolean; turnstileSiteKey?: string }) {
  const categorySlug = usePathname().split("/products/")[1]?.split("/")[1] || undefined;
  const category = division.categories.find(item => item.slug === categorySlug);
  const title = category?.name[language] || division.name[language];
  useEffect(() => { document.title = `${title} | ZhuDuo`; }, [title]);
  const products = catalogueProducts(sourceProducts, division).filter(product => !categorySlug || product.category === categorySlug);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { setSearch(""); setPage(1); }, [categorySlug, division.slug]);
  const matches = products.filter(product => `${product.title} ${product.summary}`.toLowerCase().includes(search.trim().toLowerCase()));
  const pageCount = Math.ceil(matches.length / 24);
  const currentPage = Math.min(page, Math.max(pageCount, 1));
  const visible = matches.slice((currentPage - 1) * 24, currentPage * 24);
  const tr = (english: string) => translate(language, english);
  const href = (division?: string, category?: string, anchor?: string) => catalogueHref(division, category, language, anchor, previewRoutes);
  return <CatalogueShell language={language} products={sourceProducts} settings={settings} previewRoutes={previewRoutes} inquiryPreview={inquiryPreview} turnstileSiteKey={turnstileSiteKey}>
    <section className="pv-category-banner"><div className="container"><div><span className="eyebrow">{division.name[language]} / {tr("PRODUCT COLLECTION")}</span><h1>{title}</h1><p>{category ? translate(language, "Explore {title} for your project.", { title: title.toLowerCase() }) : division.description[language]}</p></div><span className="pv-banner-index">{division.slug === "electrical" ? "01" : "02"}<small> / ZHUDUO</small></span></div></section>
    <div className="container pv-breadcrumb"><Link href={href(undefined, undefined)}>{tr("Home")}</Link><span>/</span><Link href={href(undefined, undefined, "homes")}>{tr("Products")}</Link><span>/</span><Link href={href(division.slug, undefined)}>{division.name[language]}</Link>{category && <><span>/</span><span>{title}</span></>}</div>
    <div className="container pv-catalogue-layout"><aside className="pv-sidebar"><h2>{tr("Product categories")}</h2>{divisions.map(group => <div className="pv-sidebar-group" key={group.slug}>
      <CatalogueCategoryLink href={href(group.slug, undefined)} scroll={false} className={group.slug === division.slug ? "selected" : ""}>{group.name[language]}<span>↗</span></CatalogueCategoryLink>
      {group.slug === division.slug && <div className="pv-sidebar-categories">
        <CatalogueCategoryLink href={href(group.slug, undefined)} aria-current={!category ? "page" : undefined}>{tr("View all")}<span>{tr("All")}</span></CatalogueCategoryLink>
        {group.categories.map(item => <CatalogueCategoryLink key={item.slug} href={href(group.slug, item.slug)} aria-current={category?.slug === item.slug ? "page" : undefined}>{item.name[language]}<span>›</span></CatalogueCategoryLink>)}
      </div>}
    </div>)}<div className="pv-sidebar-help"><span className="eyebrow">{tr("HERE TO HELP")}</span><h3>{tr("Need help choosing?")}</h3><p>{tr("Start with your application and brief. We can discuss a suitable direction.")}</p><button className="text-link" data-catalogue-quote={category?.slug || ""}>{tr("Discuss your brief")} ↗</button></div></aside>
      <section className="pv-catalogue-content"><div className="pv-list-heading"><div><span className="eyebrow">{tr("EXPLORE THE COLLECTION")}</span><h2>{category ? title : tr("Find your starting point")}</h2></div><span>{`${products.length} ${tr("products")}`}</span></div>
        <p className="pv-list-description">{tr("Product images and information come from our company materials. Final specifications are confirmed for each project.")}</p>
        {!!products.length && <label className="pv-catalogue-search">{tr("Search models or products")}<input type="search" dir="auto" value={search} placeholder={tr("e.g. D7, AC01, 1000 kVA")} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>}
        <div className="pv-product-grid">
          {visible.map(product => <article className="pv-product-card" key={product.slug} data-product-slug={product.slug}>
            <Link className="pv-product-image" href={productHref(division.slug, product.category, product.slug, language, previewRoutes)} aria-label={translate(language, "View information about {title}", { title: product.title })}>{product.image ? <img src={product.image} alt={product.title} loading="lazy"/> : <span className="pv-image-pending"><span aria-hidden="true">▱</span><small>{tr("Product image in preparation")}</small></span>}<span className="pv-image-arrow" aria-hidden="true">↗</span></Link>
            <div className="pv-card-copy" id={product.slug}>
              <span className="eyebrow">{division.categories.find(item => item.slug === product.category)?.name[language]}</span><h3><Link href={productHref(division.slug, product.category, product.slug, language, previewRoutes)}><LocalizedText text={product.title} language={language}/></Link></h3><p><LocalizedText text={product.summary} language={language}/></p>
              <Link className="pv-card-info" href={productHref(division.slug, product.category, product.slug, language, previewRoutes)}>{tr("View product information")} <span aria-hidden="true">↗</span></Link>
              <button className="pv-card-quote" data-catalogue-quote={product.slug}>{tr("Inquire about this product")}<span>↗</span></button>
            </div>
          </article>)}
        </div>
        {!visible.length && <div className="pv-catalogue-empty"><p role="status">{search.trim() ? tr("No matching products. Try another model or keyword.") : tr("No published products in this category. Contact us to discuss your project.")}</p><button className="text-link" data-catalogue-quote={category?.slug || ""}>{tr("Discuss your brief")} ↗</button></div>}
        {pageCount > 1 && <nav className="pv-pagination" aria-label={tr("Product pagination")}><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>{tr("Previous")}</button><span aria-live="polite">{currentPage} / {pageCount} · {matches.length} {tr("products")}</span><button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>{tr("Next")}</button></nav>}
        <div className="pv-catalogue-bottom"><span>{tr("A clearer collection. A simpler next step.")}</span><Link href={href(division.slug === "electrical" ? "modular-housing" : "electrical", undefined)}>{tr("Explore our other business")} →</Link></div>
      </section>
    </div>
  </CatalogueShell>;
}
