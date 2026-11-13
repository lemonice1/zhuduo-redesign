"use client";

import Link from "next/link";
import { useState } from "react";
import type { Product } from "../../lib/content";
import type { ApplicationContent } from "../../lib/application-content";
import ApplicationArticle from "./application-article";
import type { DocumentLibrary } from "../../lib/document-library";
import TechnicalDocuments from "./technical-documents";
import type { SiteLanguage } from "../../lib/site-language";
import LocalizedText from "../localized-text";
import { architectureCopy, siteApplicationImage, siteApplicationProducts, siteHref } from "../../lib/site-architecture";
import { siteCopy } from "./copy";
import { useSiteArchitecture } from "./architecture-context";

export function SiteProductCard({ product, language, previewRoutes = false }: { product: Product; language: SiteLanguage; previewRoutes?: boolean }) {
  const { page: sitePage, categoryPath: siteProductCategoryPath, productHref: siteProductHref } = useSiteArchitecture();
  const t = siteCopy[language];
  const summary = product.summary || sitePage(siteProductCategoryPath(product))?.name[language] || product.category;
  const href = siteProductHref(product, language, previewRoutes);
  return <article className="hp-product-card"><Link className="hp-product-image" href={href} aria-label={`${t.viewProduct}: ${product.title}`}>{product.imageUrl && <img src={product.imageUrl} alt={product.title} loading="lazy"/>}</Link>
    <div className="hp-product-copy"><h4><Link href={href}><LocalizedText text={product.title} language={language}/></Link></h4>
      <p className="hp-product-summary"><LocalizedText text={summary} language={language}/></p>
      <Link className="hp-product-action" href={href}>{t.viewProduct}<span aria-hidden="true">↗</span></Link>
    </div></article>;
}

function SiteCatalogue({ path, language, products, previewRoutes = false }: { path: string; language: SiteLanguage; products: Product[]; previewRoutes?: boolean }) {
  const { navigation: siteNavigation, products: siteProducts } = useSiteArchitecture();
  const t = architectureCopy[language];
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const collection = siteProducts(path, products);
  const matches = collection.filter(product => `${product.title} ${product.slug} ${product.summary}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const total = Math.ceil(matches.length / 12);
  const division = siteNavigation.find(item => item.slug === path.split("/")[0])!;
  return <section className="hp-section hp-catalogue"><div className="hp-container hp-catalogue-layout">
    <aside className="hp-categories"><h2>{t.category}</h2><Link href={siteHref(division.slug, language, previewRoutes)} scroll={false} aria-current={path === division.slug ? "page" : undefined}>{t.all}</Link>
      {division.children?.map(item => <div className="hp-category-family" key={item.slug}><Link href={siteHref(`${division.slug}/${item.slug}`, language, previewRoutes)} scroll={false} aria-current={path === `${division.slug}/${item.slug}` ? "page" : undefined}>{item.name[language]}</Link>
        {item.children?.map(child => <Link className="hp-category-leaf" key={child.slug} href={siteHref(`${division.slug}/${item.slug}/${child.slug}`, language, previewRoutes)} scroll={false} aria-current={path.endsWith(`/${child.slug}`) ? "page" : undefined}>{child.name[language]}</Link>)}</div>)}
    </aside>
    <div className="hp-catalogue-results"><div className="hp-catalogue-toolbar"><span><b>{matches.length}</b> {t.count}</span><label><span className="hp-sr">{t.search}</span><input type="search" placeholder={t.search} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} dir="auto"/></label></div>
      {collection.length ? matches.length ? <><div className="hp-product-grid">{matches.slice((page - 1) * 12, page * 12).map(product => <SiteProductCard key={product.slug} product={product} language={language} previewRoutes={previewRoutes}/>)}</div>
        {total > 1 && <nav className="hp-pagination" aria-label={t.all}><button disabled={page === 1} onClick={() => { setPage(value => value - 1); document.querySelector(".hp-catalogue-toolbar")?.scrollIntoView({ block: "start" }); }}>{t.previous}</button><span>{page} / {total}</span><button disabled={page === total} onClick={() => { setPage(value => value + 1); document.querySelector(".hp-catalogue-toolbar")?.scrollIntoView({ block: "start" }); }}>{t.next}</button></nav>}
      </> : <div className="hp-empty"><h2>{t.noResults}</h2><button className="hp-text-link" onClick={() => { setSearch(""); setPage(1); }}>{t.clear} ↗</button></div> : <div className="hp-empty"><span className="hp-empty-symbol" aria-hidden="true">＋</span><h2>{t.empty}</h2><p>{t.emptyNote}</p><Link className="hp-text-link" href={siteHref("contact", language, previewRoutes)}>{t.request} ↗</Link></div>}
    </div>
  </div></section>;
}

export default function SectionPage({ path, language, products, previewRoutes = false, faqs = [], applicationPage = null, documentLibraries = [] }: { path: string; language: SiteLanguage; products: Product[]; previewRoutes?: boolean; faqs?: [string, string][]; applicationPage?: ApplicationContent | null; documentLibraries?: DocumentLibrary[] }) {
  const { navigation: siteNavigation, page: sitePage, products: siteProducts, productHref: siteProductHref } = useSiteArchitecture();
  const t = architectureCopy[language], home = siteCopy[language];
  const page = sitePage(path)!;
  const [section, leaf] = path.split("/");
  const faq = faqs.length || !previewRoutes ? faqs : [[home.faqQuestion1, home.faqAnswer1], [home.faqQuestion2, home.faqAnswer2], [t.faq3, t.answer3], [t.faq4, t.answer4]];
  if (section === "electrical" || section === "modular-buildings") return <SiteCatalogue key={path} path={path} language={language} products={products} previewRoutes={previewRoutes}/>;
  if (section === "applications" && leaf) {
    if (applicationPage) return <ApplicationArticle content={applicationPage} language={language}/>;
    const index = siteNavigation.find(item => item.slug === "applications")!.children!.findIndex(item => item.slug === leaf);
    const selected = siteApplicationProducts(leaf, products);
    const description = [home.energyDescription, home.industryDescription, home.accommodationDescription, home.commercialDescription][index];
    return <><section className="hp-section"><div className="hp-container hp-application-intro"><div><span className="hp-eyebrow">ZHUDUO / {page.name[language]}</span><h2>{t.needs}</h2><p>{description}</p><p>{t.needsNote}</p><Link className="hp-text-link" href={siteHref("contact", language, previewRoutes)}>{t.request} ↗</Link></div>
      <div className={`hp-application-image${index < 2 ? " hp-application-equipment" : ""}`}><img src={siteApplicationImage(leaf, products)} alt=""/><span className="hp-reference-badge">{home.referenceImage}</span></div>
    </div></section>{selected.length > 0 && <section className="hp-section hp-related-collection"><div className="hp-container"><div className="hp-section-title"><span className="hp-eyebrow">{home.products}</span><h2>{t.relevant}</h2></div><div className="hp-product-grid">{selected.map(product => <SiteProductCard key={product.slug} product={product} language={language} previewRoutes={previewRoutes}/>)}</div></div></section>}</>;
  }
  if (section === "resources") {
    if (leaf === "technical-documents") return <TechnicalDocuments libraries={documentLibraries} language={language}/>;
    if (leaf === "faqs") return <section className="hp-section hp-resource-faq"><div className="hp-container hp-faq-grid"><h2>{home.faqTitle}</h2><div>{faq.length ? faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>) : <Link className="hp-text-link" href={siteHref("contact", language, previewRoutes)}>{t.request} ↗</Link>}</div></div></section>;
    if (leaf) return <section className="hp-section"><div className="hp-container"><p className="hp-document-intro">{leaf === "product-catalogues" ? t.cataloguesNote : t.technicalNote}</p><div className="hp-download-grid">{siteNavigation.filter(item => ["electrical", "modular-buildings"].includes(item.slug)).map(item => {
      const collection = siteProducts(item.slug, products);
      const documents = [...new Map(collection.filter(product => product.brochureUrl).map(product => [product.brochureUrl, product])).values()];
      return <article className="hp-download-card" key={item.slug}>
        <div className="hp-document-symbol" aria-hidden="true">{leaf === "product-catalogues" ? "PDF" : "↗"}</div><h2>{item.name[language]}</h2>
        <div className="hp-download-list">{leaf === "product-catalogues" ? documents.length ? documents.map(product => <a key={product.brochureUrl} href={product.brochureUrl} target="_blank" rel="noopener noreferrer"><LocalizedText text={product.title} language={language}/><span aria-hidden="true">↗</span></a>) : <p>{t.documentPending}</p> : collection.map(product => <Link key={product.slug} href={`${siteProductHref(product, language, previewRoutes)}#product-specifications`}><LocalizedText text={product.title} language={language}/><span aria-hidden="true">↗</span></Link>)}</div>
        <Link className="hp-text-link" href={siteHref(item.slug, language, previewRoutes)}>{t.online} ↗</Link><Link className="hp-text-link" href={siteHref("contact", language, previewRoutes)}>{t.requestDocument} ↗</Link>
      </article>;
    })}</div></div></section>;
    return <section className="hp-section"><div className="hp-container hp-resource-links">{page.children?.map((item, index) => <Link className="hp-resource-link" key={item.slug} href={siteHref(`resources/${item.slug}`, language, previewRoutes)}><span className="hp-document-symbol" aria-hidden="true">{["PDF", "↗", "?"][index]}</span><h2>{item.name[language]}</h2><p>{[t.cataloguesNote, t.technicalNote, home.faqTitle][index]}</p><span className="hp-text-link">{home.explore} ↗</span></Link>)}</div></section>;
  }
  return null;
}
