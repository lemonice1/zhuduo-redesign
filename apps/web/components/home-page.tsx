"use client";

import { siteLanguage, translate } from "../lib/site-language";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import InquiryForm from "./inquiry-form";
import BrandLogo from "./brand-logo";
import HomeDivisionHero from "./home-division-hero";
import HomeProductShowcase from "./home-product-showcase";
import { categories as productCategories } from "../lib/catalogue";
import LanguagePicker from "./language-picker";
import NavDropdown from "./nav-dropdown";
import ProductNavigation from "./catalogue/product-navigation";
import { copy, projects, type Language } from "./home-copy";
import type { HomepageContent } from "../lib/content";

const asset = (name: string) => name.startsWith("/") ? name : `/living/${name}`;
type Panel = { kind: "project"; index: number } | { kind: "quote" | "success" | "credits" | "privacy" };

function Wire() {
  return <svg className="wire" viewBox="0 0 200 180" fill="none" aria-hidden="true"><path d="M10 75 83 33l100 58-73 42ZM10 98 83 56l100 58-73 42ZM10 121 83 79l100 58-73 42Z" stroke="currentColor" /></svg>;
}

function Modal({ children, wide, variant, onClose, label }: { children: ReactNode; wide: boolean; variant?: "success"; onClose: () => void; label: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    document.body.classList.add("modal-open");
    return () => {
      dialog.close();
      document.body.classList.remove("modal-open");
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return <dialog ref={ref} className={wide ? "wide" : variant === "success" ? "success-modal" : ""} aria-labelledby="dialog-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
    const box = event.currentTarget.getBoundingClientRect();
    if (event.target === event.currentTarget && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) onClose();
  }}>
    <button className="close" aria-label={label} onClick={onClose} autoFocus>×</button>
    {children}
  </dialog>;
}

export default function HomePage({ products, faqs, settings, language = "en", turnstileSiteKey = "", previewRoutes = false, inquiryPreview = false }: HomepageContent & { language?: Language; turnstileSiteKey?: string; previewRoutes?: boolean; inquiryPreview?: boolean }) {
  const router = useRouter();
  const t = copy[language];
  const tr = (english: string) => translate(language, english);
  const pair = (value: readonly [string, string]) => language === "ar" ? value[1] : tr(value[0]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<"product" | "resource" | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [productType, setProductType] = useState("");
  const [application, setApplication] = useState("General");
  const navigation = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const siteName = settings?.siteName || "ZhuDuo";
  const quote = (slug = "", use = "General") => { setProductType(slug); setApplication(use); setPanel({ kind: "quote" }); setActiveDropdown(null); setMenuOpen(false); };
  const toggleDropdown = (id: "product" | "resource", open: boolean) => setActiveDropdown(current => open ? id : current === id ? null : current);

  useEffect(() => {
    if (panel) document.querySelector<HTMLButtonElement>("dialog .close")?.focus();
  }, [panel?.kind]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = "ltr";
    // An explicit URL always wins over a saved preference.
    try {
      const saved = siteLanguage(localStorage.getItem("zhuduo-language") || undefined);
      if (!new URLSearchParams(window.location.search).has("lang") && saved !== "en" && saved !== language) router.replace(`?lang=${saved}${window.location.hash}`);
      else localStorage.setItem("zhuduo-language", language);
    } catch { /* The page remains usable when storage is blocked. */ }
  }, [language, router]);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!navigation.current?.contains(event.target as Node) && !menuButton.current?.contains(event.target as Node)) { setMenuOpen(false); setActiveDropdown(null); }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || panel) return;
      if (menuOpen && !activeDropdown) { setMenuOpen(false); menuButton.current?.focus(); }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", escape); };
  }, [menuOpen, activeDropdown, panel]);

  return <>
    <a className="skip" href="#main">{tr("Skip to content")}</a>
    <div className="notice"><div className="container"><span>✳ <span>{t.announcement}</span></span><span>{t.preview}</span></div></div>
    <header><div className="container nav-row">
      <a className="brand" href="#home" aria-label={tr("ZHUDUO home")}><BrandLogo /></a>
      <nav ref={navigation} id="navigation" className={menuOpen ? "open" : ""} aria-label={tr("Main navigation")} onClick={event => { if ((event.target as HTMLElement).closest("a")) { setMenuOpen(false); setActiveDropdown(null); } }}>
        <a href="#home">{t.home}</a>
        <ProductNavigation language={language} previewRoutes={previewRoutes} open={activeDropdown === "product"} onOpenChange={open => toggleDropdown("product", open)}/>
        <a href="#about">{t.about}</a><a href="#projects">{t.projects}</a>
        <NavDropdown id="resource" label={t.resources} open={activeDropdown === "resource"} onOpenChange={open => toggleDropdown("resource", open)}>
          <a href="#faq">{t.faq}</a>
        </NavDropdown>
      </nav>
      <div className="nav-actions"><LanguagePicker language={language} onChange={value => router.push(`?lang=${value}${window.location.hash}`)} /><button className="btn primary small" onClick={() => quote()}>{t.build}<span>↗</span></button><button ref={menuButton} id="menu" aria-label={menuOpen ? tr("Close navigation") : tr("Open navigation")} aria-expanded={menuOpen} aria-controls="navigation" onClick={() => { setMenuOpen(!menuOpen); setActiveDropdown(null); }}>{menuOpen ? "×" : "☰"}</button></div>
    </div></header>
    <main id="main">
      <HomeDivisionHero language={language} previewRoutes={previewRoutes}/>
      <section className="benefits"><div className="container">{[["▱", t.benefit1, t.benefit1sub], ["☷", t.benefit2, t.benefit2sub], ["◎", t.benefit3, t.benefit3sub]].map(([icon, title, sub]) => <div key={title}><span className="line-icon" aria-hidden="true">{icon}</span><span><b>{title}</b><small>{sub}</small></span></div>)}<a href="#homes" className="circle" aria-label={t.explore}>↓</a></div></section>
      <HomeProductShowcase products={products} language={language} previewRoutes={previewRoutes} onInquiry={() => quote()}/>
      <section className="section about" id="about"><div className="container about-grid"><div className="about-photo"><img src="/products/capsule-interior.webp" alt={tr("Space capsule interior from our product brochure")} loading="lazy" /><div className="image-badge"><span aria-hidden="true">♧</span><span className="multiline">{t.imageBadge}</span></div><span className="vertical-label">{tr("ZHUDUO / MODULAR LIVING")}</span></div><div className="about-copy"><span className="eyebrow">{t.aboutEyebrow}</span><h2>{t.aboutTitle}<br /><em>{t.aboutItalic}</em></h2><p>{t.aboutDescription}</p><ul><li>{t.point1}</li><li>{t.point2}</li><li>{t.point3}</li></ul><button className="text-link" onClick={() => quote()}>{t.talk} ↗</button></div></div></section>
      <section className="section applications" id="projects"><div className="container"><div className="heading"><div><span className="eyebrow">{t.applicationsEyebrow}</span><h2>{t.applicationsTitle}</h2><p>{t.applicationsDescription}</p></div><span className="large-arrow" aria-hidden="true">↗</span></div><div className="project-grid">{projects.map((project, index) => <button className="project" key={index} onClick={() => setPanel({ kind: "project", index })}><img src={asset(project.image)} alt="" loading="lazy" /><span className="pill">{pair(project.category)}</span><span className="project-bottom"><span className="project-title">{pair(project.title)}</span><span aria-hidden="true">↗</span></span></button>)}</div><p className="caption">{t.conceptNote}</p></div></section>
      <section className="section" id="faq"><div className="container faq-grid"><div><span className="eyebrow">{t.faqEyebrow}</span><h2>{t.faqTitle}</h2><button className="text-link" onClick={() => quote()}>{t.talk} ♧</button></div><div>{faqs.map(([question, answer], index) => <details key={question} open={index === 0 ? true : undefined}><summary>{question}</summary><p>{answer}</p></details>)}{!faqs.length && <p className="empty-state">{tr("Have a question? Share it with us in your project brief.")}</p>}</div></div></section>
      <section className="contact"><div className="container"><div><span className="eyebrow">{t.contactEyebrow}</span><h2>{t.contactTitle}<br /><em>{t.contactItalic}</em></h2></div><div><p>{t.contactDescription}</p><button className="btn cream" onClick={() => quote()}>{t.start} ↗</button></div><Wire /></div></section>
    </main>
    <footer><div className="container"><div className="footer-grid"><div><a className="brand" href="#home" aria-label={tr("ZHUDUO home")}><BrandLogo /></a><p className="multiline">{t.footerDescription}</p></div><div><h3>{t.exploreShort}</h3><a href="#homes">{t.homes}</a><a href="#about">{t.about}</a><a href="#projects">{t.projects}</a></div><div><h3>{t.help}</h3><a href="#faq">{t.faq}</a><button onClick={() => quote()}>{t.inquiry}</button>{settings?.contactEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.contactEmail) && <a href={`mailto:${encodeURIComponent(settings.contactEmail)}`}>{settings.contactEmail}</a>}</div><div className="footer-message"><span className="eyebrow">{t.footerEyebrow}</span><button onClick={() => quote()}>{t.build} ↗</button><p>{settings?.footerNote || t.footerNote}</p></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} {siteName}</span><button onClick={() => setPanel({ kind: "credits" })}>{t.credits}</button><button onClick={() => setPanel({ kind: "privacy" })}>{t.privacy}</button></div></div></footer>
    <button className="floating" onClick={() => quote()} aria-label={t.build}><span aria-hidden="true">☏</span><span>{t.build}</span></button>
    {panel && <Modal wide={panel.kind === "project"} variant={panel.kind === "success" ? "success" : undefined} onClose={() => setPanel(null)} label={tr("Close dialog")}>
      {panel.kind === "quote" && <div className="modal-copy"><span className="eyebrow">{t.inquiry}</span><h2 id="dialog-title">{t.start}</h2><p>{tr("Tell us about your site, intended use and plans.")}</p><InquiryForm products={products} directions={productCategories.map(category => ({ value: category.slug, title: category.name[language] }))} productType={productType} setProductType={setProductType} activeApplication={application} turnstileSiteKey={turnstileSiteKey} language={language} preview={inquiryPreview} onConfirmed={() => setPanel({ kind: "success" })} /><p className="form-note">{inquiryPreview ? tr("Design preview: information is not sent or stored.") : tr("Submitting sends your contact details and project brief to our inquiry service for project follow-up.")}</p></div>}
      {panel.kind === "success" && <div className="success-copy"><div className="success-symbol" aria-hidden="true"><span>✓</span></div><span className="eyebrow">{tr("A new possibility")}</span><h2 id="dialog-title">{inquiryPreview ? tr("Inquiry preview complete.") : tr("Inquiry submitted successfully.")}</h2><p>{inquiryPreview ? tr("No information was sent or stored.") : tr("Thank you for your inquiry. We will contact you soon.")}</p><button className="btn primary success-done" onClick={() => setPanel(null)}>{tr("Done")} <span aria-hidden="true">✓</span></button></div>}
      {panel.kind === "project" && <div className="detail-layout"><div className="detail-image"><img src={asset(projects[panel.index].image)} alt={t.photoTag} /></div><div className="modal-copy"><span className="eyebrow">{pair(projects[panel.index].category)}</span><h2 id="dialog-title">{pair(projects[panel.index].title)}</h2><p>{pair(projects[panel.index].description)}</p><p className="caption">{t.conceptNote}</p><button className="btn primary" onClick={() => quote("", projects[panel.index].category[0])}>{t.talk} ↗</button></div></div>}
      {panel.kind === "credits" && <div className="modal-copy"><span className="eyebrow">ZhuDuo</span><h2 id="dialog-title">{t.credits}</h2><p>{tr("Product images come from our company housing brochures and electrical product materials. Application illustrations describe possible uses. Reference photographs by Clay Banks / Unsplash appear only when a product image is unavailable.")}</p><div className="credit-links">{["6LSKem6Fkt4", "5PclUXShx30", "kiv1ggvkgQk", "pPhjlD9U4mA"].map((id, index) => <a key={id} href={`https://unsplash.com/photos/${id}`} target="_blank" rel="noreferrer">Clay Banks · {tr("Photograph")} {index + 1} ↗</a>)}<a href="https://unsplash.com/license" target="_blank" rel="noreferrer">Unsplash License ↗</a><p>{tr("Website typeface: Alibaba PuHuiTi 3.0.")}</p></div></div>}
      {panel.kind === "privacy" && <div className="modal-copy"><span className="eyebrow">{siteName}</span><h2 id="dialog-title">{t.privacy}</h2><p>{tr("The inquiry form collects your name, email, country or region, and project information. Submissions are stored in the site's inquiry system for project follow-up. Please only include information relevant to your project.")}</p><p>{tr("Your language preference is stored in this browser. If inquiry verification is enabled, Cloudflare Turnstile is used to check submissions.")}</p><a className="text-link" href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">Cloudflare · {t.privacy} ↗</a></div>}
    </Modal>}
  </>;
}
