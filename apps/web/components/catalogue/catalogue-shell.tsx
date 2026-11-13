"use client";

import { translate } from "../../lib/site-language";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import LanguagePicker from "../language-picker";
import InquiryForm from "../inquiry-form";
import BrandLogo from "../brand-logo";
import ProductNavigation from "./product-navigation";
import { categories, divisions, catalogueHref, type CatalogueLanguage } from "../../lib/catalogue";
import type { HomepageContent, Product } from "../../lib/content";

export default function CatalogueShell({ children, language, products, settings, previewRoutes, inquiryPreview, turnstileSiteKey, defaultProduct = "" }: {
  children: ReactNode; language: CatalogueLanguage; products: Product[]; settings: HomepageContent["settings"];
  previewRoutes: boolean; inquiryPreview: boolean; turnstileSiteKey: string;
  defaultProduct?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [intention, setIntention] = useState("");
  const [session, setSession] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const position = useRef({ left: 0, top: 0 });
  const router = useRouter();
  const pathname = usePathname();
  const tr = (english: string) => translate(language, english);
  const href = (division?: string, category?: string, anchor?: string) => catalogueHref(division, category, language, anchor, previewRoutes);
  const siteName = settings?.siteName || "ZhuDuo";

  const quote = (product = defaultProduct) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    position.current = { left: window.scrollX, top: window.scrollY };
    setIntention(product);
    setSubmitted(false);
    setSession(value => value + 1);
    setMenuOpen(false);
    dialog.current?.showModal();
    document.body.classList.add("modal-open");
    window.scrollTo({ ...position.current, behavior: "instant" });
  };
  const close = () => {
    dialog.current?.close();
    if (!document.querySelector("dialog[open]")) document.body.classList.remove("modal-open");
    if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    window.scrollTo({ ...position.current, behavior: "instant" });
  };
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = "ltr";
    try { localStorage.setItem("zhuduo-language", language); } catch { /* Storage is optional. */ }
    return () => document.body.classList.remove("modal-open");
  }, [language]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!header.current?.contains(event.target as Node)) setMenuOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  return <div className={`catalogue-site pv-catalogue-page${previewRoutes ? " site-preview" : ""}`} onClick={event => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-catalogue-quote]");
    if (target) quote(target.dataset.catalogueQuote || defaultProduct);
  }}>
    <a className="skip" href="#catalogue-main">{tr("Skip to content")}</a>
    <div className="pv-preview-bar"><div className="container"><span>{previewRoutes ? tr("Design preview · Electrical equipment × Modular housing") : tr("Electrical equipment and modular spaces, shaped around your brief.")}</span><Link href={href()}>{tr("Back to home")} ↗</Link></div></div>
    <header ref={header} className="pv-header" onKeyDown={event => {
      if (event.key === "Escape" && menuOpen) { setMenuOpen(false); menuTrigger.current?.focus(); }
    }}><div className="container nav-row">
      <Link className="brand" href={href()} aria-label={tr("ZHUDUO home")}><BrandLogo /></Link>
      <nav className={menuOpen ? "open" : ""} aria-label={tr("Main navigation")} id="catalogue-navigation" onClick={event => { if ((event.target as HTMLElement).closest("a")) setMenuOpen(false); }}>
        <Link href={href()}>{tr("Home")}</Link>
        <ProductNavigation language={language} previewRoutes={previewRoutes}/>
        <Link href={href(undefined, undefined, "projects")}>{tr("Applications")}</Link>
        <Link href={href(undefined, undefined, "about")}>{tr("About us")}</Link>
        <button onClick={() => quote()}>{tr("Contact")}</button>
      </nav>
      <div className="nav-actions"><LanguagePicker language={language} onChange={value => router.push(`${pathname}?lang=${value}` as Route)}/><button className="btn primary small pv-header-quote" onClick={() => quote()}>{tr("Get a quote")} <span>↗</span></button><button ref={menuTrigger} className="pv-mobile-toggle" aria-label={tr("Toggle navigation")} aria-expanded={menuOpen} aria-controls="catalogue-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? "×" : "☰"}</button></div>
    </div></header>
    <main id="catalogue-main">{children}</main>
    <section className="pv-cta"><div className="container"><div><span className="eyebrow">{tr("LET’S PLAN YOUR PROJECT")}</span><h2>{tr("A clear next step for your project.")}</h2><p>{tr("Share your product needs, application and project plans.")}</p></div><button className="btn cream" onClick={() => quote()}>{tr("Tell us about your project")} ↗</button></div></section>
    <footer className="pv-footer"><div className="container"><div className="pv-footer-top"><div><Link className="brand" href={href()} aria-label={tr("ZHUDUO home")}><BrandLogo /></Link><p>{tr("Electrical equipment and modular spaces, shaped around your brief.")}</p>{settings?.contactEmail && <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>}</div>{divisions.map(division => <div key={division.slug}><Link className="pv-footer-title" href={href(division.slug)}>{division.name[language]} ↗</Link>{division.categories.map(category => <Link key={category.slug} href={href(division.slug, category.slug)}>{category.name[language]}</Link>)}</div>)}</div><div className="footer-bottom"><span>© {siteName}</span><span>{settings?.footerNote || tr("Electrical equipment · Modular housing")}</span></div></div></footer>
    <dialog ref={dialog} className="pv-inquiry" aria-labelledby="catalogue-inquiry-title" onCancel={event => { event.preventDefault(); close(); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    }}><button className="close" onClick={close} aria-label={tr("Close")}>×</button><div className="modal-copy"><span className="eyebrow">{tr("PROJECT INQUIRY")}</span><h2 id="catalogue-inquiry-title">{submitted ? inquiryPreview ? tr("Inquiry preview complete") : tr("Inquiry submitted successfully") : tr("Tell us about your project")}</h2>{submitted ? <><p>{inquiryPreview ? tr("No information was sent or stored.") : tr("Thank you for your inquiry. We will contact you soon.")}</p><button className="btn primary" onClick={close}>{tr("Continue browsing")} →</button></> : <><InquiryForm key={session} products={products} directions={categories.map(category => ({ value: category.slug, title: category.name[language] }))} activeApplication="General" source={`catalogue:${pathname}`} productType={intention} setProductType={setIntention} language={language} turnstileSiteKey={inquiryPreview ? "" : turnstileSiteKey} preview={inquiryPreview} onConfirmed={() => setSubmitted(true)}/><p className="form-note">{inquiryPreview ? tr("Local preview. Information is not sent or stored.") : tr("Your contact details and project brief are saved to our inquiry system for project follow-up.")}</p></>}</div></dialog>
  </div>;
}
