"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { catalogueHref, divisions, productCategory, productHref } from "../lib/catalogue";
import type { Product } from "../lib/content";
import { translate, type SiteLanguage } from "../lib/site-language";
import { copy } from "./home-copy";
import LocalizedText from "./localized-text";

const collectionOrder = ["modular-housing", "electrical"] as const;

function CollectionIcon({ electrical = false }: { electrical?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {electrical ? <path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z" /> : <><path d="m3 10 9-7 9 7v11H3V10Z" /><path d="M9 21v-8h6v8" /></>}
  </svg>;
}

function ProductPhoto({ product, index, language }: { product: Product; index: number; language: SiteLanguage }) {
  const [failed, setFailed] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (product.imageUrl && image.current?.complete && image.current.naturalWidth === 0) setFailed(true);
  }, [product.imageUrl]);
  const isReference = !product.imageUrl || failed;
  const fallback = ["cabin.jpg", "retreat.jpg", "studio.jpg"];
  return <>
    <img ref={image} className={!isReference && product.imageUrl.startsWith("/products/") ? "showcase-render" : undefined}
      src={isReference ? `/living/${fallback[index % fallback.length]}` : product.imageUrl}
      alt={isReference ? translate(language, "Architectural inspiration, not a product photograph") : ""}
      loading="lazy" onError={() => setFailed(true)} />
    {isReference && <span className="image-reference">{translate(language, "Reference photography")}</span>}
  </>;
}

export default function HomeProductShowcase({ products, language, previewRoutes = false, onInquiry }: {
  products: Product[];
  language: SiteLanguage;
  previewRoutes?: boolean;
  onInquiry: () => void;
}) {
  const [selected, setSelected] = useState<string>("modular-housing");
  const collections = collectionOrder.map(slug => divisions.find(division => division.slug === slug)!);
  const division = collections.find(item => item.slug === selected)!;
  const matching = products.filter(product => division.categories.some(category => category.slug === productCategory(product)));
  // Give each available category a place before showing more of the same type.
  const grouped = new Map<string, Product[]>();
  for (const product of matching) {
    const category = productCategory(product)!;
    const group = grouped.get(category) || [];
    group.push(product);
    grouped.set(category, group);
  }
  const groups = [...grouped.values()];
  const featured: Product[] = [];
  for (let index = 0; featured.length < 5; index++) {
    const row = groups.flatMap(group => group[index] ? [group[index]] : []);
    if (!row.length) break;
    featured.push(...row.slice(0, 5 - featured.length));
  }
  const tr = (text: string) => translate(language, text);
  const t = copy[language];

  return <section className="section home-product-showcase" id="homes" aria-labelledby="showcase-title">
    <div className="container showcase-layout">
      <aside className="showcase-sidebar" aria-labelledby="showcase-navigation-title">
        <div className="showcase-sidebar-heading" id="showcase-navigation-title"><span className="showcase-mark" aria-hidden="true">▱</span>{tr("Product")}</div>
        <div className="showcase-choices" role="group" aria-label={tr("Product divisions")}>
          {collections.map(collection => <button key={collection.slug} type="button" aria-pressed={selected === collection.slug} aria-controls="showcase-results" onClick={() => setSelected(collection.slug)}>
            <CollectionIcon electrical={collection.slug === "electrical"} /><span>{collection.name[language]}</span><span className="showcase-choice-arrow" aria-hidden="true">↗</span>
          </button>)}
        </div>
        <span className="showcase-sidebar-note" aria-hidden="true">ZHUDUO / {tr("Product system")}</span>
      </aside>
      <div className="showcase-main">
        <div className="showcase-heading"><h2 id="showcase-title">{tr("Product system")}</h2><button type="button" className="btn primary small" onClick={onInquiry}>{t.inquiry}<span aria-hidden="true">↗</span></button></div>
        <div className="showcase-results" id="showcase-results" role="region" aria-label={division.name[language]}>
          {featured.length ? <div className={`showcase-grid showcase-${division.slug}`} key={division.slug}>
            {featured.map((product, index) => <article className="product showcase-card" key={product.slug}>
              <ProductPhoto product={product} index={index} language={language} />
              <span className="showcase-card-arrow" aria-hidden="true">↗</span>
              <div className="showcase-card-copy"><span className="showcase-category">{product.category}</span>
                <h3><Link className="showcase-card-trigger" href={productHref(division.slug, productCategory(product)!, product.slug, language, previewRoutes)} aria-label={`${tr("Discover")} ${product.title}`}><LocalizedText text={product.title} language={language} /></Link></h3>
                <p><LocalizedText text={product.summary} language={language} /></p>
              </div>
            </article>)}
          </div> : <div className="empty-state showcase-empty"><p>{tr("The collection is being prepared. Tell us what you have in mind.")}</p><button type="button" className="text-link" onClick={onInquiry}>{t.talk} ↗</button></div>}
        </div>
        <div className="showcase-footer"><span role="status">{translate(language, "Showing {count} of {total} products", { count: featured.length, total: matching.length })}</span><Link href={catalogueHref(division.slug, undefined, language, undefined, previewRoutes)}>{t.viewAll}<span aria-hidden="true">↗</span></Link></div>
      </div>
    </div>
  </section>;
}
