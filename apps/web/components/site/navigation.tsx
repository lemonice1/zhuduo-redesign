"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SiteLanguage } from "../../lib/site-language";
import { siteHref } from "../../lib/site-architecture";

import { useSiteArchitecture } from "./architecture-context";

function ProjectIcon({ slug }: { slug: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {slug === "featured-projects" ? <path d="M3 7V5a2 2 0 0 1 2-2h5l3 3h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/> : slug === "case-studies" ? <><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 8h6M9 12h6M9 16h3"/></> : <><path d="m3 7 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 17l9 5 9-5"/></>}
  </svg>;
}

export default function SiteNavigation({ language, path, mobileOpen, onNavigate, previewRoutes = false }: { language: SiteLanguage; path: string; mobileOpen: boolean; onNavigate: () => void; previewRoutes?: boolean }) {
  const { navigation: siteNavigation } = useSiteArchitecture();
  const [open, setOpen] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuItems = siteNavigation.filter(item => item.slug !== "about").map(item => item.slug === "projects" ? { ...item, children: undefined } : item);
  const aboutLabel = siteNavigation.find(item => item.slug === "about")!.name[language];
  useEffect(() => { if (!mobileOpen) setOpen(null); }, [mobileOpen]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(null); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  return <nav ref={root} id="hp-navigation" className={`hp-nav hp-architecture-nav${mobileOpen ? " hp-nav-open" : ""}`} aria-label={language === "ar" ? "التنقل الرئيسي" : language === "fr" ? "Navigation principale" : "Main navigation"}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(null); }}
    onKeyDown={event => { if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(null); triggers.current[open]?.focus(); } }}
    onClick={event => { if ((event.target as HTMLElement).closest("a")) { setOpen(null); onNavigate(); } }}>
    {menuItems.map(item => <div className={`hp-nav-item${path.split("/")[0] === item.slug ? " hp-nav-active" : ""}`} key={item.slug}
      onMouseEnter={() => { if (window.matchMedia("(hover:hover) and (min-width:1360px)").matches) setOpen(item.children ? item.slug : null); }}
      onMouseLeave={() => { if (window.matchMedia("(hover:hover) and (min-width:1360px)").matches) setOpen(null); }}>
      <div className="hp-nav-item-row"><Link href={siteHref(item.slug, language, previewRoutes)} aria-current={path === item.slug ? "page" : undefined}>{item.slug === "contact" ? aboutLabel : item.name[language]}</Link>
        {item.children && <button ref={el => { triggers.current[item.slug] = el; }} type="button" className="hp-nav-toggle" aria-label={item.name[language]} aria-expanded={open === item.slug} aria-controls={`hp-subnav-${item.slug}`} onClick={() => setOpen(open === item.slug ? null : item.slug)}><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3.5 6 4.5 4 4.5-4"/></svg></button>}
      </div>
      {item.children && open === item.slug && <div className={`hp-nav-dropdown${item.slug === "projects" ? " hp-nav-projects" : ""}`} id={`hp-subnav-${item.slug}`}>
        {item.children.filter(child => item.slug !== "resources" || !["product-catalogues", "faqs"].includes(child.slug)).map(child => child.children ? <div className="hp-nav-family" key={child.slug}>
          <Link className="hp-nav-family-title" href={siteHref(`${item.slug}/${child.slug}`, language, previewRoutes)}>{child.name[language]}<span aria-hidden="true">↗</span></Link>
          {child.children.map(leaf => <Link key={leaf.slug} href={siteHref(`${item.slug}/${child.slug}/${leaf.slug}`, language, previewRoutes)}>{leaf.name[language]}</Link>)}
        </div> : <Link key={child.slug} href={siteHref(`${item.slug}/${child.slug}`, language, previewRoutes)}>{item.slug === "projects" && <ProjectIcon slug={child.slug}/>}<span dir="auto">{child.name[language]}</span></Link>)}
      </div>}
    </div>)}
  </nav>;
}
