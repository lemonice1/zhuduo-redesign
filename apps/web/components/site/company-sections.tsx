import type { HomepageContent } from "../../lib/content";
import type { SiteLanguage } from "../../lib/site-language";
import { siteCopy } from "./copy";

// Set to true to restore project stories on the homepage.
const SHOW_HOMEPAGE_PROJECTS = false;

export default function CompanySections({ language, products, cases = [], previewRoutes }: HomepageContent & { language: SiteLanguage; previewRoutes: boolean }) {
  const t = siteCopy[language];
  const placeholderImages = ["/products/company/expandable-40ft.webp", "/products/company/d7-exterior-setting.webp", products.find(product => product.slug === "power-110kv-10000kva")?.imageUrl];
  return <>
    {SHOW_HOMEPAGE_PROJECTS && (previewRoutes || cases.length > 0) && <section className="hp-section hp-projects" id="projects"><div className="hp-container">
      <div className="hp-section-title hp-reveal"><span className="hp-eyebrow">{t.projectsEyebrow}</span><h2>{t.projectsTitle}</h2>{previewRoutes && <p>{t.projectsNote}</p>}</div>
      <div className="hp-case-grid hp-reveal">{previewRoutes ? placeholderImages.map((image, index) => <article className={`hp-case${index === 2 ? " hp-case-electrical" : ""}`} key={index}><div className="hp-case-image">{image && <img src={image} alt="" loading="lazy"/>}<span className="hp-reference-badge">{t.referenceImage}</span></div><div className="hp-case-copy"><span>{t.projectPlaceholder} / 0{index + 1}</span><h3>{t.projectPending}</h3><p>{t.projectFields}</p></div></article>) : cases.map(item => <article className="hp-case" key={`${item.title}:${item.imageUrl}`}><div className="hp-case-image"><img src={item.imageUrl} alt={item.title} loading="lazy"/></div><div className="hp-case-copy"><span>{item.location}</span><h3>{item.title}</h3><p>{item.productName} · {item.quantity}</p>{item.summary && <p>{item.summary}</p>}</div></article>)}</div>
    </div></section>}
    <section className="hp-section hp-resources" id="credentials"><div className="hp-container">
      <div className="hp-section-title hp-reveal"><span className="hp-eyebrow">{t.credentialsEyebrow}</span><h2>{t.credentialsTitle}</h2></div>
      <div className="hp-exhibition-banner hp-reveal">
        <img src="/brand/big-5-global-2026.png?v=897bf722" alt="Big 5 Global 2026 · Dubai World Trade Centre · 23–26 Nov 2026 · Build-up ~22 Nov" width={1672} height={941} loading="lazy"/>
      </div>
    </div></section>
  </>;
}
