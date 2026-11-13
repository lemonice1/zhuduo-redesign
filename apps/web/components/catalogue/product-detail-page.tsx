"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { catalogueHref, categories, productCategory, productHref, type CatalogueCategory, type CatalogueDivision } from "../../lib/catalogue";
import type { HomepageContent, Product } from "../../lib/content";
import { translate, type SiteLanguage } from "../../lib/site-language";
import InquiryForm from "../inquiry-form";
import LocalizedText from "../localized-text";
import ProductGallery from "../product-gallery";
import CatalogueShell from "./catalogue-shell";

export function productFacts(detail: string) {
  return detail.split(/\r?\n/).flatMap(line => {
    const match = line.trim().match(/^([^:：]{1,90})[:：]\s*(.+)$/);
    return match ? [{ label: match[1], value: match[2] }] : [];
  });
}

export function ProductFaq({ language, electrical, categoryHref, productFaqs }: { language: SiteLanguage; electrical: boolean; categoryHref: Route; productFaqs?: Product["productFaqs"] }) {
  const tr = (text: string) => translate(language, text);
  const faq = [
    ["Are you a manufacturer or a trading company?", "We are a manufacturer company and we offer both virtual and on-site tours at any time."],
    ["What products can you supply?", "We mainly supply prefab houses, container houses, folding container houses, expandable container houses, and other related building materials."],
    ["Do you offer design services?", "Yes, we have professional architects who provide design services based on your requirements."],
    ["How do you guarantee product quality?", "We fully prove our quality through free samples, welcome factory audits anytime, and our products are certified with CE, UL, SAA, ISO9001, RoHS."]
  ];
  const entries = productFaqs?.length ? productFaqs.map(row => [row.question, row.answer]) : faq.map(row => row.map(tr));
  return <div className="pd-faq"><span className="eyebrow">{tr("HERE TO HELP")}</span><h2>{tr("Frequently asked questions")}</h2>{entries.map(([question, answer], index) => <details key={`${index}:${question}`}><summary><LocalizedText text={question} language={language}/></summary><p className="multiline"><LocalizedText text={answer} language={language}/></p></details>)}<Link className="text-link" href={categoryHref}>← {tr("Back to collection")}</Link></div>;
}

export default function ProductDetailPage({ product, division, category, language, products, settings, previewRoutes = false, inquiryPreview = false, turnstileSiteKey = "", embedded = false, links, directions, categoryForProduct = productCategory }: {
  product: Product; division: CatalogueDivision; category: CatalogueCategory; language: SiteLanguage;
  products: Product[]; settings: HomepageContent["settings"]; previewRoutes?: boolean; inquiryPreview?: boolean; turnstileSiteKey?: string;
  categoryForProduct?: (product: Product) => string | undefined;
  embedded?: boolean; links?: { home: Route; division: Route; category: Route; related: Record<string, Route> };
  directions?: { value: string; title: string }[];
}) {
  const tr = (text: string) => translate(language, text);
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const [productType, setProductType] = useState(product.slug);
  const [submitted, setSubmitted] = useState(false);
  const facts = productFacts(product.detail).filter(fact => !["product", "produit", "المنتج"].includes(fact.label.toLowerCase()));
  const highlights = facts.length ? facts.slice(0, 5).map(fact => `${fact.label}: ${fact.value}`) : product.options.length ? product.options.slice(0, 5) : [product.summary].filter(Boolean);
  const description = product.detail.split(/\r?\n/).filter(line => line.trim() && !/^([^:：]{1,90})[:：]\s*(.+)$/.test(line.trim())).join("\n");
  const pictures = [...new Set([product.imageUrl, ...(product.galleryUrls || [])].filter(Boolean))];
  const relatedInDivision = products.filter(item => item.slug !== product.slug && division.categories.some(itemCategory => itemCategory.slug === categoryForProduct(item)));
  const related = [...relatedInDivision.filter(item => categoryForProduct(item) === category.slug), ...relatedInDivision.filter(item => categoryForProduct(item) !== category.slug)].slice(0, 5);
  const categoryHref = links?.category ?? catalogueHref(division.slug, category.slug, language, undefined, previewRoutes);
  const inquiryHref = embedded ? "#contact" : "#product-inquiry";
  const container = embedded ? "hp-container" : "container";

  useEffect(() => {
    const node = root.current;
    if (!node || !window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add("pd-visible");
        observer.unobserve(entry.target);
      }
    }, { threshold: .08 });
    node.dataset.animate = "true";
    node.querySelectorAll(".pd-reveal").forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const content = <div className={`product-detail-page pd-${division.slug}`} ref={root}>
      <div className={`${container} pv-breadcrumb pd-breadcrumb`} aria-label={tr("Product information")}>
        <Link href={links?.home ?? catalogueHref(undefined, undefined, language, undefined, previewRoutes)}>{tr("Home")}</Link><span aria-hidden="true">/</span>
        <Link href={links?.division ?? catalogueHref(division.slug, undefined, language, undefined, previewRoutes)}>{division.name[language]}</Link><span aria-hidden="true">/</span>
        <Link href={categoryHref}>{category.name[language]}</Link><span aria-hidden="true">/</span><span aria-current="page"><LocalizedText text={product.title} language={language}/></span>
      </div>
      <div className={`${container} pd-title`}><span className="eyebrow">{category.name[language]}</span><h1><LocalizedText text={product.title} language={language}/></h1><p><LocalizedText text={product.summary} language={language}/></p></div>
      <section className={`${container} pd-glance`} aria-labelledby="product-glance-title" tabIndex={0}>
        <div className="pd-glance-image">{product.imageUrl ? <img src={product.imageUrl} alt={product.title} fetchPriority="high"/> : <span>{tr("Product image in preparation")}</span>}</div>
        <div className="pd-glance-copy"><span className="pd-kicker">ZHUDUO / {tr("PRODUCT COLLECTION")}</span><h2 id="product-glance-title">{tr("At a glance")}</h2>
          <ul>{highlights.map((highlight, index) => <li key={highlight} style={{ "--fact-index": index } as CSSProperties}><span className="pd-check" aria-hidden="true">✓</span><LocalizedText text={highlight} language={language}/></li>)}</ul>
          <a className="btn pd-glance-inquiry" href={inquiryHref}>{tr("Inquire about this product")}<span aria-hidden="true">↗</span></a>
        </div>
      </section>
      <section className={`${container} pd-overview pd-reveal`} id="product-overview" aria-labelledby="product-overview-title">
        <div className="pd-overview-copy"><span className="eyebrow">{tr("Product information")}</span><h2 id="product-overview-title">{tr("Product overview")}</h2><p className="pd-lead"><LocalizedText text={product.summary} language={language}/></p>
          {description && <p className="multiline"><LocalizedText text={description} language={language}/></p>}
          {!!product.options.length && <ul className="pd-option-list">{product.options.map(option => <li key={option}><LocalizedText text={option} language={language}/></li>)}</ul>}
          <a className="text-link" href={inquiryHref}>{tr("Discuss your brief")}<span aria-hidden="true">↗</span></a>
        </div>
        <div className="pd-gallery" id="product-gallery"><ProductGallery image={product.imageUrl} images={product.galleryUrls} title={product.title} language={language}/></div>
      </section>
      {pictures.length > 2 && <section className={`${container} pd-visuals pd-reveal`} aria-labelledby="product-visuals-title"><div className="pd-section-heading"><div><span className="eyebrow">{category.name[language]}</span><h2 id="product-visuals-title">{tr("A closer look")}</h2></div></div>
        <div className="pd-visual-grid">{pictures.slice(1, 5).map((picture, index) => <figure key={picture}><img src={picture} alt={`${product.title} — ${index + 2}`} loading="lazy"/><figcaption><span>{tr("Product gallery")}</span><span>{String(index + 2).padStart(2, "0")}</span></figcaption></figure>)}</div>
      </section>}
      <section className="pd-specifications" id="product-specifications" aria-labelledby="product-specifications-title"><div className={`${container} pd-reveal`}>
        <div className="pd-specifications-grid"><div className="pd-specifications-content">
          <div className="pd-section-heading"><div><span className="eyebrow">{tr("Product information")}</span><h2 id="product-specifications-title">{tr("Technical specifications")}</h2><p>{tr("Final specifications are confirmed for each project.")}</p></div></div>
          <table className="pd-specification-table"><caption>{product.title}</caption><tbody>
          {[{ label: tr("Model"), value: product.title }, { label: tr("Category"), value: category.name[language] }, ...facts].map((fact, index) => <tr key={`${index}:${fact.label}`}><th scope="row"><LocalizedText text={fact.label} language={language}/></th><td><LocalizedText text={fact.value} language={language}/></td></tr>)}
          </tbody></table>
          </div>
          <aside className="pd-configuration"><span className="eyebrow">{category.name[language]}</span><h3>{tr("Configuration and options")}</h3>{product.options.length ? <ul>{product.options.map(option => <li key={option}><LocalizedText text={option} language={language}/></li>)}</ul> : <p>{tr("Discuss the required configuration with us for your project.")}</p>}
            {product.brochureUrl && <a className="product-brochure" href={product.brochureUrl} target="_blank" rel="noopener noreferrer">{tr("View product brochure (PDF)")} ↗</a>}
            <button type="button" className="btn primary pd-quote" data-catalogue-quote={product.slug}>{tr("Get a quote")}<span aria-hidden="true">↗</span></button>
          </aside>
        </div>
      </div></section>
      {!!related.length && <section className={`${container} pd-related pd-reveal`} aria-labelledby="product-related-title"><div className="pd-section-heading"><div><span className="eyebrow">{division.name[language]}</span><h2 id="product-related-title">{tr("More products to explore")}</h2></div><Link className="text-link" href={categoryHref}>{tr("View all")}<span aria-hidden="true">↗</span></Link></div>
        <div className="pd-related-grid">{related.map(item => <Link className="pd-related-card" key={item.slug} href={links?.related[item.slug] ?? productHref(division.slug, categoryForProduct(item)!, item.slug, language, previewRoutes)}>
          {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy"/> : <span className="pd-related-pending">{tr("Product image in preparation")}</span>}<span className="pd-related-arrow" aria-hidden="true">↗</span><div><span className="eyebrow">{division.categories.find(row => row.slug === categoryForProduct(item))?.name[language] || item.category}</span><h3><LocalizedText text={item.title} language={language}/></h3></div>
        </Link>)}</div>
      </section>}
      {!embedded && <section className="container pd-project pd-reveal" id="product-inquiry" aria-labelledby="product-inquiry-title">
        <ProductFaq language={language} electrical={division.slug === "electrical"} categoryHref={categoryHref} productFaqs={product.productFaqs}/>
        <div className="pd-inline-inquiry"><span className="eyebrow">{tr("PROJECT INQUIRY")}</span><h2 id="product-inquiry-title">{tr("Tell us about your project")}</h2><p className="pd-inquiry-product"><LocalizedText text={product.title} language={language}/></p>
          {submitted ? <div className="pd-inline-success" role="status"><span aria-hidden="true">✓</span><h3>{inquiryPreview ? tr("Inquiry preview complete") : tr("Inquiry submitted successfully")}</h3><p>{inquiryPreview ? tr("No information was sent or stored.") : tr("Thank you for your inquiry. We will contact you soon.")}</p><button type="button" className="text-link" onClick={() => { setProductType(product.slug); setSubmitted(false); }}>{tr("Send another inquiry")} ↗</button></div> : <><InquiryForm products={products} directions={directions ?? categories.map(item => ({ value: item.slug, title: item.name[language] }))} activeApplication="General" productType={productType} setProductType={setProductType} language={language} preview={inquiryPreview} turnstileSiteKey={inquiryPreview ? "" : turnstileSiteKey} source={`catalogue:${pathname}`} onConfirmed={() => setSubmitted(true)}/><p className="form-note">{inquiryPreview ? tr("Local preview. Information is not sent or stored.") : tr("Your contact details and project brief are saved to our inquiry system for project follow-up.")}</p></>}
        </div>
      </section>}
    </div>;
  return embedded ? content : <CatalogueShell language={language} products={products} settings={settings} previewRoutes={previewRoutes} inquiryPreview={inquiryPreview} turnstileSiteKey={turnstileSiteKey} defaultProduct={product.slug}>{content}</CatalogueShell>;
}
