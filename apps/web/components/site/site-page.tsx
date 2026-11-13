"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import BrandLogo from "../brand-logo";
import LanguagePicker from "../language-picker";
import ProductDetailPage, { ProductFaq } from "../catalogue/product-detail-page";
import InquiryForm from "../inquiry-form";
import OkkiFormContext from "../okki-form-context";
import ProductDirectionPicker from "../product-direction-picker";
import { ArchitectureProvider, useSiteArchitecture } from "./architecture-context";
import type { Product, HomepageContent } from "../../lib/content";
import type { ApplicationContent } from "../../lib/application-content";
import { documentCopy, type DocumentLibrary } from "../../lib/document-library";
import { siteLanguage, translate, type SiteLanguage } from "../../lib/site-language";
import { siteCopy } from "./copy";
import SiteNavigation from "./navigation";
import SectionPage, { SiteProductCard } from "./section-page";
import CompanySections from "./company-sections";
import CountUpNumber from "./count-up-number";
import Chatbox from "./chatbox";
import ProjectsPage from "./projects-page";
import ProjectDetailPage from "./project-detail-page";
import type { ProjectDetail } from "../../lib/project-detail";
import { architectureCopy, siteApplicationImage, siteHref } from "../../lib/site-architecture";

const featuredSlugs = {
  electrical: ["scb10-10kv-250kva", "oil-10kv-1000kva", "power-110kv-10000kva", "substation-yb"],
  housing: ["expandable-20ft", "expandable-40ft", "space-capsule-d7", "flat-pack-house"]
};

// Set to true to restore the applications section on the homepage.
const SHOW_HOMEPAGE_APPLICATIONS = false;

// Set to true to restore the caption bar below the homepage hero.
const SHOW_HOMEPAGE_HERO_CAPTION = false;

// Set to true to restore the Contact page banner.
const SHOW_CONTACT_BANNER = false;

const companyContact = {
  name: "Zhuduo (Beijing) Technology Co., Ltd.",
  website: "www.bjzdbuilding.com",
  email: "sales@bjzdbuilding.com",
  whatsappNumber: "8618610537088",
  address: "Floor 30, Block C, Tower 2, Wangjing SOHO\nNo. 1 Futong East Street, Chaoyang District\nBeijing 100102, China"
};

function Icon({ kind, className = "" }: { kind: "arrow" | "power" | "house" | "factory" | "document" | "mail" | "whatsapp" | "pin" | "globe"; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "arrow" && <path d="M5 19 19 5M5 5h14v14"/>}
    {kind === "power" && <path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z"/>}
    {kind === "house" && <><path d="m3 10 9-7 9 7v11H3V10Z"/><path d="M9 21v-8h6v8"/></>}
    {kind === "factory" && <><path d="M3 21V10l6-4v5l6-4v14H3ZM16 21h5V3h-4l-1 13M6 15h1m4 0h1m-6 3h1m4 0h1"/></>}
    {kind === "document" && <><path d="M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 12h8M8 15h5"/><circle cx="12" cy="19" r="1"/></>}
    {kind === "mail" && <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></>}
    {kind === "pin" && <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/></>}
    {kind === "globe" && <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>}
    {kind === "whatsapp" && <><path d="m3 21 1.5-5A9 9 0 1 1 8 20L3 21Z"/><path d="m8 7 2 3-1 1c1 2 2 3 4 4l1-1 3 1c-1 4-8 1-10-4-1-2 0-3 1-4Z"/></>}
  </svg>;
}

function FactoryPlaceholder({ title, note }: { title: string; note: string }) {
  return <div className="hp-factory-placeholder">
    <div className="hp-factory-drawing" aria-hidden="true"><svg viewBox="0 0 460 230" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M22 196h414M53 195V102l88-43v43l88-43v136M229 195V122l81-39v112M322 195l8-161h39l8 161M79 130h31v26H79zm59 0h31v26h-31zm59 0h18v26h-18zM75 195v-20h40v20m47 0v-20h40v20m57-50h25v24h-25zM335 50h30M334 67h32M34 211h378"/></svg></div>
    <div className="hp-factory-caption"><Icon kind="factory"/><div><h3>{title}</h3><p>{note}</p></div></div>
    <span className="hp-photo-corner" aria-hidden="true">+</span>
  </div>;
}

function CompanyVideo({ label, playLabel }: { label: string; playLabel: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);

  function play() {
    if (!video.current) return;
    setStarted(true);
    void video.current.play().catch(() => setPlaying(false));
  }

  return <div className="hp-company-video">
    <video ref={video} controls={started} playsInline preload="none" poster="/videos/zhuduo-company-introduction-poster.webp" width={1280} height={720} aria-label={label}
      onPlay={() => { setStarted(true); setPlaying(true); }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => setPlaying(false)}>
      <source src="/videos/zhuduo-company-introduction.mp4" type="video/mp4"/>
      <a href="/videos/zhuduo-company-introduction.mp4">{playLabel}</a>
    </video>
    {!playing && <button className="hp-company-video-play" type="button" aria-label={playLabel} onClick={play}>
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7-11-7Z"/></svg>
    </button>}
  </div>;
}

function SitePageContent({ language, products, view = "home", path = "", product, settings = null, faqs = [], cases = [], certificates = [], previewRoutes = false, inquiryPreview = false, turnstileSiteKey = "", applicationPage = null, documentLibraries = [], projectDetail = null }: Pick<HomepageContent, "products"> & Partial<Omit<HomepageContent, "products">> & { language: SiteLanguage; view?: string; path?: string; product?: Product; previewRoutes?: boolean; inquiryPreview?: boolean; turnstileSiteKey?: string; applicationPage?: ApplicationContent | null; documentLibraries?: DocumentLibrary[]; projectDetail?: ProjectDetail | null }) {
  const { navigation: siteNavigation, page: sitePage, categoryPath: siteProductCategoryPath, productHref: siteProductHref, products: siteProducts, directions: siteInquiryDirections, divisions, productCategory } = useSiteArchitecture();
  const t = siteCopy[language];
  const contactEmail = settings?.contactEmail || companyContact.email;
  const whatsappNumber = settings?.whatsappNumber || companyContact.whatsappNumber;
  const whatsappLabel = /^86\d{11}$/.test(whatsappNumber) ? `+86 ${whatsappNumber.slice(2)}` : `+${whatsappNumber}`;
  const whatsappHref = `https://api.whatsapp.com/send?phone=${whatsappNumber}`;
  const tr = (text: string) => translate(language, text);
  const a = architectureCopy[language];
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [productType, setProductType] = useState(product?.slug || "");
  const [submitted, setSubmitted] = useState(false);
  const [certificationsPaused, setCertificationsPaused] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const base = siteHref("", language, previewRoutes);
  const homeAnchor = (anchor: string) => (view === "home" ? `#${anchor}` : `${base}#${anchor}`) as Route;
  const sectionHref = (section: string) => siteHref(section, language, previewRoutes);
  const selectedProducts = (division: keyof typeof featuredSlugs) => {
    const collection = siteProducts(division === "housing" ? "modular-buildings" : "electrical", products);
    return [...new Map([...collection.filter(product => product.featured), ...featuredSlugs[division].flatMap(slug => collection.filter(product => product.slug === slug)), ...collection].map(product => [product.slug, product])).values()].slice(0, 4);
  };
  const productLink = (product: Product) => siteProductHref(product, language, previewRoutes);
  const appCards = [
    { id: "energy-utilities", title: t.energy, description: t.energyDescription, image: siteApplicationImage("energy-utilities", products), electrical: true },
    { id: "industrial-projects", title: t.industry, description: t.industryDescription, image: siteApplicationImage("industrial-projects", products), electrical: true },
    { id: "residential-hospitality", title: t.accommodation, description: t.accommodationDescription, image: siteApplicationImage("residential-hospitality", products), electrical: false },
    { id: "commercial-temporary-buildings", title: t.commercial, description: t.commercialDescription, image: siteApplicationImage("commercial-temporary-buildings", products), electrical: false }
  ];

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = "ltr";
    if (!previewRoutes) {
      try {
        const saved = siteLanguage(localStorage.getItem("zhuduo-language") || undefined);
        if (!new URLSearchParams(window.location.search).has("lang") && saved !== language) router.replace(`${pathname}?lang=${saved}${window.location.hash}` as Route);
        else localStorage.setItem("zhuduo-language", language);
      } catch { /* Storage is optional. */ }
    }
    const element = root.current;
    if (!element || !window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("hp-visible"); observer.unobserve(entry.target); }
    }), { threshold: .06 });
    element.dataset.animate = "true";
    element.querySelectorAll(".hp-reveal").forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [language, view, path, pathname, previewRoutes, router]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); } };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [menuOpen]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  function stats() {
    const foundedYear = settings?.foundedYear ?? 2008;
    const factoryArea = settings?.factoryArea ?? 100000;
    const exportMarkets = settings?.exportMarkets ?? 100;
    const certificationLogos = ["zjwl", "certification-2", "certification-3"];
    return <section className="hp-statistics" aria-label={t.companyFigures}><div className="hp-container hp-stat-grid">
      <div className="hp-stat"><strong dir="ltr"><CountUpNumber value={foundedYear}/></strong><span>{t.founded}</span></div>
      <div className="hp-stat"><strong dir="ltr"><CountUpNumber value={factoryArea} grouping/><small>{t.unit}</small></strong><span>{t.footprint}</span></div>
      <div className="hp-stat"><strong dir="ltr"><CountUpNumber value={exportMarkets}/>+<small>{t.countries}</small></strong><span>{t.markets}</span></div>
      <div className="hp-stat"><button type="button" className="hp-certification-logos" aria-label={`${t.certifications}: ${t.pauseScrolling}`} aria-pressed={certificationsPaused} title={certificationsPaused ? t.resumeScrolling : t.pauseScrolling} onClick={() => setCertificationsPaused(paused => !paused)}><span className="hp-certification-logos-track">
        {[0, 1].map(copy => <span className="hp-certification-logos-group" key={copy} aria-hidden={copy === 1 ? true : undefined}>{certificationLogos.map((logo, index) => <img key={logo} src={`/certifications/${logo}.png`} alt={copy === 0 ? `${t.certifications} ${index + 1}` : ""} width={52} height={42} loading="lazy"/>)}</span>)}
      </span></button><span>{t.certifications}</span></div>
    </div></section>;
  }

  function about() {
    const companyIntro = settings?.companyIntro || (view === "about" ? t.aboutPageDescription : t.aboutDescription);
    return <section className="hp-section hp-about" id="about"><div className="hp-container hp-about-grid hp-reveal">
      <div className="hp-about-copy"><span className="hp-eyebrow">{view === "home" ? t.homeAboutEyebrow : t.aboutEyebrow}</span><h2>{view === "home" ? t.homeAboutTitle : t.aboutTitle}</h2>{companyIntro.split(/\r?\n\s*\r?\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        <div className="hp-about-lines"><span><Icon kind="power"/>{t.electrical}</span><span><Icon kind="house"/>{t.housing}</span></div>
        <Link className="hp-text-link" href={view === "about" ? homeAnchor("contact") : sectionHref("about")}>{view === "about" ? t.quote : t.aboutAction}<Icon kind="arrow"/></Link>
      </div>{view === "home" ? <CompanyVideo label={t.companyVideo} playLabel={t.watchCompanyVideo}/> : settings?.factoryImageUrl ? <div className="hp-factory-photo"><img src={settings.factoryImageUrl} alt={t.factoryPhoto} loading="lazy"/></div> : <FactoryPlaceholder title={t.factoryPhoto} note={t.factoryPending}/>}
    </div></section>;
  }

  function featured() {
    return <section className="hp-section hp-featured" id="products"><div className="hp-container">
      <div className="hp-section-title hp-reveal"><span className="hp-eyebrow">{t.featuredEyebrow}</span><h2>{t.featuredTitle}</h2><p>{t.featuredNote}</p></div>
      {(["electrical", "housing"] as const).filter(division => selectedProducts(division).length).map(division => <div className="hp-product-collection hp-reveal" key={division}>
        <div className="hp-collection-heading"><h3><Icon kind={division === "electrical" ? "power" : "house"}/>{t[division]}</h3><Link className="hp-text-link" href={sectionHref(division === "electrical" ? "electrical" : "modular-buildings")}>{t.viewAll}<Icon kind="arrow"/></Link></div>
        <div className="hp-product-grid">{selectedProducts(division).map(product => <SiteProductCard key={product.slug} product={product} language={language} previewRoutes={previewRoutes}/>)}</div>
      </div>)}
    </div></section>;
  }

  function applications() {
    return <section className="hp-section hp-applications" id="applications"><div className="hp-container">
      <div className="hp-heading-row hp-reveal"><div className="hp-section-title"><span className="hp-eyebrow">{t.applicationsEyebrow}</span><h2>{t.applicationsTitle}</h2><p>{t.applicationsNote}</p></div>{view === "home" && <Link className="hp-text-link" href={sectionHref("applications")}>{t.allApplications}<Icon kind="arrow"/></Link>}</div>
      <div className="hp-app-grid hp-reveal">{appCards.map((app, index) => <Link className={`hp-app-card${app.electrical ? " hp-app-electrical" : ""}`} key={app.id} href={sectionHref(`applications/${app.id}`)}>
        <img src={app.image} alt="" loading="lazy"/><span className="hp-reference-badge">{t.referenceImage}</span><span className="hp-app-number" aria-hidden="true">0{index + 1}</span><div className="hp-app-copy"><h3>{app.title}</h3><span>{t.applicationAction}<Icon kind="arrow"/></span></div>
      </Link>)}</div>
      {view === "applications" && !path.includes("/") && <div className="hp-app-details">{appCards.map(app => <article className="hp-app-detail" key={app.id} id={app.id}><Icon kind={app.electrical ? "power" : "house"}/><div><h2>{app.title}</h2><p>{app.description}</p><Link className="hp-text-link" href={sectionHref(`applications/${app.id}`)}>{t.applicationAction}<Icon kind="arrow"/></Link></div></article>)}</div>}
    </div></section>;
  }

  const currentPage = sitePage(path);
  const productDivision = product ? divisions.find(division => division.categories.some(category => category.slug === productCategory(product))) : undefined;
  const productCategoryPath = product ? siteProductCategoryPath(product) : "";
  const productCategoryName = sitePage(productCategoryPath)?.name;
  const detailCategory = productDivision?.categories.find(category => category.slug === productCategory(product!));
  const pageTitle = applicationPage?.title || (view === "about" ? t.aboutPageTitle : view === "applications" && !path.includes("/") ? t.applicationsPageTitle : currentPage?.name[language]);
  const pageNote = applicationPage ? applicationPage.summary : path === "resources/technical-documents" ? documentCopy[language].intro : view === "about" ? t.aboutPageNote : view === "applications" ? a.applicationNote : view === "projects" ? t.projectsPageNote : view === "resources" ? a.resourcesNote : view === "contact" ? a.contactNote : a.collectionNote;

  return <div className={`zhuduo-site hp-preview${previewRoutes ? " site-preview" : ""}`} ref={root} onClick={event => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-catalogue-quote]");
    if (target) { setSubmitted(false); setProductType(target.dataset.catalogueQuote || product?.slug || ""); document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" }); }
  }}>
    <a className="skip" href="#hp-main">{t.home}</a>
    <header className="hp-header"><div className="hp-container hp-nav-row"><Link className="brand" href={base as Route} aria-label="ZHUDUO"><BrandLogo/></Link>
      <SiteNavigation language={language} path={product ? productCategoryPath : path} previewRoutes={previewRoutes} mobileOpen={menuOpen} onNavigate={() => setMenuOpen(false)}/>
      <div className="hp-nav-actions"><LanguagePicker language={language} openOnHover onChange={value => router.push(`${pathname}?lang=${value}${window.location.hash}` as Route)}/><Link className="btn primary hp-quote" href="#contact">{t.quote}<span aria-hidden="true">↗</span></Link>
        <button className="hp-menu-button" ref={menuButton} aria-label={menuOpen ? t.close : t.open} aria-expanded={menuOpen} aria-controls="hp-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? "×" : "☰"}</button>
      </div>
    </div></header>
    <main id="hp-main">
      {view === "home" ? <>
        <section className="hp-hero" id="home" aria-label={`${t.housing} · ${t.electrical}`}><h1 className="hp-sr">ZHUDUO — {t.electrical} &amp; {t.housing}</h1><div className="hp-hero-grid">
          {(["housing", "electrical"] as const).map(division => {
            const electrical = division === "electrical";
            const slug = electrical ? "electrical" : "modular-buildings";
            return <article className={`hp-hero-panel hp-hero-${division}`} key={division}>
              <Link className="hp-panel-link" href={sectionHref(slug)} aria-label={`${t.explore}: ${t[division]}`}>
                <div className="hp-hero-media"><img className="hp-hero-image" src={electrical ? settings?.heroElectricalImageUrl || "/brand/hero-electrical-equipment.webp" : settings?.heroHousingImageUrl || "/products/company/d7-exterior-setting.webp"} alt="" fetchPriority="high"/></div>
                <div className="hp-hero-copy"><h2>{t[division]}</h2><div className="hp-hero-details"><div>
                  <p dir="auto">{electrical ? t.electricalDescription : t.housingDescription}</p>
                  <span className="hp-hero-action">{t.explore}<Icon kind="arrow"/></span>
                </div></div></div>
              </Link>
            </article>;
          })}
        </div>{SHOW_HOMEPAGE_HERO_CAPTION && <div className="hp-hero-caption"><span>ZHUDUO</span><span>{previewRoutes ? t.previewLabel : `${t.housing} · ${t.electrical}`}</span><a href="#about" aria-label={t.about}>↓</a></div>}</section>
        {stats()}{about()}{featured()}{SHOW_HOMEPAGE_APPLICATIONS && applications()}
        <CompanySections language={language} products={products} faqs={faqs} settings={settings} cases={cases} certificates={certificates} previewRoutes={previewRoutes}/>
      </> : projectDetail ? <ProjectDetailPage project={projectDetail} language={language} products={products} directions={siteInquiryDirections(language)} inquiryPreview={inquiryPreview || previewRoutes} turnstileSiteKey={turnstileSiteKey}/> : product && productDivision && detailCategory ? <ProductDetailPage product={product} products={products} language={language} settings={settings} division={{ ...productDivision, name: { ...productDivision.name, ...siteNavigation.find(item => item.slug === productCategoryPath.split("/")[0])!.name } }} category={{ ...detailCategory, name: { ...detailCategory.name, ...productCategoryName } }} embedded categoryForProduct={productCategory} inquiryPreview={inquiryPreview || previewRoutes} previewRoutes={previewRoutes} turnstileSiteKey={turnstileSiteKey} directions={siteInquiryDirections(language)} links={{ home: base as Route, division: sectionHref(productCategoryPath.split("/")[0]), category: sectionHref(productCategoryPath), related: Object.fromEntries(products.map(item => [item.slug, productLink(item)])) }}/> : <>
        {view === "contact" ? <>
        {SHOW_CONTACT_BANNER && <section className="hp-contact-hero" aria-labelledby="contact-hero-title">
          <img className="hp-contact-hero-image" src="/brand/contact-banner-placeholder.svg" alt="" fetchPriority="high"/>
          <div className="hp-container hp-contact-hero-copy"><h1 id="contact-hero-title">{t.contactTitle}</h1><p>{pageNote}</p>
            <nav className="hp-contact-breadcrumb" aria-label={t.contact}><Link href={base as Route}><Icon kind="house"/><span>{t.home}</span></Link><span aria-hidden="true">/</span><span aria-current="page">{t.contact}</span></nav>
          </div>
        </section>}
        <section className="hp-section hp-contact-manufacturing" aria-labelledby="contact-manufacturing-title"><div className="hp-container">
          <h2 className="hp-contact-manufacturing-title" id="contact-manufacturing-title">{t.contactManufacturingTitle}</h2>
          <div className="hp-contact-manufacturing-grid">
            <div className="hp-contact-manufacturing-copy" role="region" aria-labelledby="contact-production-heading" tabIndex={0}><h3 className="hp-contact-production-heading" id="contact-production-heading">{t.contactProductionHeading}</h3>
              {(settings?.companyIntro || t.aboutPageDescription).split(/\r?\n\s*\r?\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>
            <CompanyVideo label={t.companyVideo} playLabel={t.watchCompanyVideo}/>
          </div>
        </div></section>
        </> : <section className="hp-inner-hero"><div className="hp-container"><Link className="hp-text-link" href={base as Route}>← {t.back}</Link><span className="hp-eyebrow">ZHUDUO / {currentPage?.name[language]}</span><h1>{pageTitle}</h1><p>{pageNote}</p></div></section>}
        {view === "about" ? <>{about()}{stats()}{featured()}</> : view === "applications" && !path.includes("/") ? applications() : view === "projects" ? <ProjectsPage path={path} language={language} cases={cases} previewRoutes={previewRoutes}/> : <SectionPage path={path} language={language} products={products} previewRoutes={previewRoutes} faqs={faqs} applicationPage={applicationPage} documentLibraries={documentLibraries}/>}
      </>}
      {view === "contact" && certificates.length > 0 && <section className="hp-section hp-contact-certificates" aria-labelledby="contact-certificates-title"><div className="hp-container">
        <h2 id="contact-certificates-title">{t.certifications}</h2>
        <div className="hp-contact-certificates-grid">{certificates.map(certificate => <figure key={certificate.url}>
          <a href={certificate.url} target="_blank" rel="noopener noreferrer" aria-label={certificate.title}>{certificate.imageUrl ? <img src={certificate.imageUrl} alt={certificate.title} width={291} height={411} loading="lazy"/> : <span className="hp-contact-certificate-file"><Icon kind="document"/></span>}</a>
          <figcaption dir="auto">{certificate.title}</figcaption>
        </figure>)}</div>
      </div></section>}
      {!projectDetail && <section className={`hp-section hp-contact${view === "contact" ? " hp-contact-page" : ""}`} id="contact"><div className="hp-container hp-contact-grid" id={product ? "product-inquiry" : undefined}>{product && productDivision ? <div className="hp-contact-copy hp-contact-faq"><ProductFaq language={language} electrical={productDivision.slug === "electrical"} categoryHref={sectionHref(productCategoryPath)} productFaqs={product.productFaqs}/></div> : <div className="hp-contact-copy">{view !== "contact" && <span className="hp-eyebrow">{t.contactEyebrow}</span>}<h2>{view === "contact" ? t.contactWelcome : t.contactTitle}</h2><p>{t.contactNote}</p>
        {view === "contact" && <div className="hp-contact-company-summary"><p dir="ltr">{companyContact.name}</p><a href={`https://${companyContact.website}`} target="_blank" rel="noopener noreferrer" dir="ltr">{companyContact.website}</a></div>}
        <div className={`hp-contact-methods${view === "contact" ? " hp-contact-company" : ""}`}>
          <div><Icon kind="mail"/><span><b>{t.email}</b><a href={`mailto:${contactEmail}`} dir="ltr">{contactEmail}</a></span></div>
          <div><Icon kind="whatsapp"/><span><b>{t.whatsapp}</b><a href={whatsappHref} target="_blank" rel="noopener noreferrer" dir="ltr">{whatsappLabel}</a></span></div>
          {view === "contact" && <div><Icon kind="pin"/><div className="hp-contact-detail"><b>{t.address}</b><address dir="ltr">{settings?.companyAddress || companyContact.address}</address></div></div>}
        </div>
      </div>}<div className="hp-inquiry-card">{view === "contact" && <h2 className="hp-contact-form-title">{t.contactFormTitle}</h2>}{submitted ? <div className="hp-form-success" role="status"><span className="hp-success-icon">✓</span><h3>{previewRoutes || inquiryPreview ? t.successTitle : tr("Inquiry submitted successfully")}</h3><p>{previewRoutes || inquiryPreview ? t.successNote : tr("Thank you for your inquiry. We will contact you soon.")}</p><button type="button" className="hp-text-link" onClick={() => { setSubmitted(false); setProductType(product?.slug || ""); }}>{t.again}<Icon kind="arrow"/></button></div> : previewRoutes && view !== "contact" && !product ? <form className="hp-form" onSubmit={submit}>
        <OkkiFormContext ignored/>
        <label>{t.name}<input name="name" autoComplete="name" required maxLength={120} dir="auto" placeholder={t.namePlaceholder}/></label>
        <label>{t.workEmail}<input name="email" type="email" autoComplete="email" required maxLength={254} dir="ltr" placeholder="you@company.com"/></label>
        <ProductDirectionPicker products={products} directions={siteInquiryDirections(language)} language={language} value={productType} onChange={setProductType}/>
        <label className="hp-form-wide">{t.message}<textarea name="message" required maxLength={4000} rows={4} dir="auto" placeholder={t.messagePlaceholder}/></label>
        <button className="btn primary hp-form-wide" type="submit">{t.submit}<Icon kind="arrow"/></button><p className="hp-form-note hp-form-wide">{t.previewNote}</p>
      </form> : <><InquiryForm compact={!product && view !== "contact"} products={products} directions={siteInquiryDirections(language)} activeApplication="General" productType={productType} setProductType={setProductType} language={language} preview={inquiryPreview || previewRoutes} turnstileSiteKey={inquiryPreview || previewRoutes ? "" : turnstileSiteKey} source={`${product ? "catalogue" : "site"}:${pathname}`} onConfirmed={() => setSubmitted(true)}/><p className="hp-form-note">{previewRoutes ? t.previewNote : inquiryPreview ? tr("Local preview. Information is not sent or stored.") : tr("Your contact details and project brief are saved to our inquiry system for project follow-up.")}</p></>}</div></div></section>}
    </main>
    <footer className="hp-footer"><div className="hp-container"><div className="hp-footer-grid">
      <div className="hp-footer-brand"><Link className="brand" href={base as Route}><BrandLogo/></Link><p>{t.footerDescription}</p></div>
      <div><h3>{t.footerNavigation}</h3><Link href={sectionHref("about")}>{t.about}</Link><Link href={sectionHref("applications")}>{t.applications}</Link><Link href={sectionHref("projects")}>{t.projects}</Link><Link href={sectionHref("resources")}>{t.resources}</Link><Link href={sectionHref("contact")}>{siteNavigation.find(item => item.slug === "contact")!.name[language]}</Link></div>
      <div><h3>{t.products}</h3><Link href={sectionHref("electrical")}>{t.electrical}</Link><Link href={sectionHref("modular-buildings")}>{t.housing}</Link><Link href="#contact">{t.quote}</Link></div>
      <div className="hp-footer-contact"><h3>{t.contact}</h3>
        <div className="hp-footer-contact-row"><Icon kind="mail"/><a href={`mailto:${contactEmail}`} dir="ltr">{contactEmail}</a></div>
        <div className="hp-footer-contact-row"><Icon kind="whatsapp"/><a href={whatsappHref} target="_blank" rel="noopener noreferrer" dir="ltr" aria-label={`WhatsApp ${whatsappLabel}`}>{whatsappLabel}</a></div>
        <div className="hp-footer-contact-row"><Icon kind="pin"/><p className="multiline" dir="ltr">{settings?.companyAddress || companyContact.address}</p></div>
      </div>
    </div>
      <div className="hp-footer-bottom"><span>© {new Date().getFullYear()} ZHUDUO</span>{previewRoutes ? <><span>{t.previewLabel}</span><Link href={`/?lang=${language}` as Route}>{t.currentHome} ↗</Link></> : <span>{settings?.footerNote || t.footerDescription}</span>}</div>
    </div></footer>
    <Chatbox language={language} pathname={pathname} productType={product?.slug || path} preview={inquiryPreview || previewRoutes} turnstileSiteKey={turnstileSiteKey}/>
  </div>;
}

export default function SitePage(props: Parameters<typeof SitePageContent>[0]) {
  return <ArchitectureProvider categories={props.productCategories}><SitePageContent {...props}/></ArchitectureProvider>;
}
