"use client";

import CatalogueCategoryLink from "./catalogue-category-link";
import { useEffect, useRef, useState } from "react";
import { divisions, catalogueHref, type CatalogueLanguage } from "../../lib/catalogue";
import { translate } from "../../lib/site-language";

export default function ProductNavigation({ language, previewRoutes = false, open: controlledOpen, onOpenChange }: { language: CatalogueLanguage; previewRoutes?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => { setInternalOpen(value); onOpenChange?.(value); };
  const [active, setActive] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelClose = () => clearTimeout(timer.current);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) { setOpen(false); setActive(null); } };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  return <div ref={root} className="nav-dropdown pv-product-nav" onPointerEnter={event => {
    cancelClose();
    if (event.pointerType === "mouse" && window.matchMedia("(min-width: 851px)").matches) setOpen(true);
  }} onPointerLeave={event => {
    if (event.pointerType === "mouse") timer.current = setTimeout(() => {
      if (!root.current?.contains(document.activeElement)) { setOpen(false); setActive(null); }
    }, 150);
  }} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { setOpen(false); setActive(null); }
  }} onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); setActive(null); trigger.current?.focus(); }
    else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && (event.target as HTMLElement).closest(".pv-cascade")) {
      event.preventDefault();
      const controls = Array.from(root.current?.querySelectorAll<HTMLElement>(".pv-cascade a, .pv-cascade button") || []).filter(control => control.getClientRects().length > 0);
      const current = controls.indexOf(document.activeElement as HTMLElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? controls.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + controls.length) % controls.length;
      controls[next]?.focus();
    }
  }}>
    <button ref={trigger} className="nav-dropdown-trigger pv-product-trigger" aria-expanded={open} aria-controls="pv-product-menu" onClick={() => { cancelClose(); setOpen(!open); }} onKeyDown={event => {
      if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); requestAnimationFrame(() => root.current?.querySelector<HTMLAnchorElement>(".pv-group-link")?.focus()); }
    }}>{translate(language, "Products")}</button>
    <div className="nav-dropdown-panel pv-cascade" id="pv-product-menu" hidden={!open}>
      {divisions.map(division => <div className="pv-nav-group" key={division.slug} onPointerEnter={event => {
        if (event.pointerType === "mouse" && window.matchMedia("(min-width: 851px)").matches) setActive(division.slug);
      }}>
        <div className={`pv-group-row ${active === division.slug ? "selected" : ""}`}>
          <CatalogueCategoryLink className="pv-group-link" href={catalogueHref(division.slug, undefined, language, undefined, previewRoutes)} onClick={() => { setOpen(false); setActive(null); }}>{division.name[language]}</CatalogueCategoryLink>
          <button className="pv-sub-toggle" aria-label={`${translate(language, "Expand")} ${division.name[language]}`} aria-expanded={active === division.slug} aria-controls={`pv-sub-${division.slug}`} onClick={() => setActive(active === division.slug ? null : division.slug)}>›</button>
        </div>
        <div id={`pv-sub-${division.slug}`} className="nav-dropdown-panel pv-submenu" hidden={active !== division.slug}>
          {division.categories.map(category => <CatalogueCategoryLink href={catalogueHref(division.slug, category.slug, language, undefined, previewRoutes)} key={category.slug} onClick={() => { setOpen(false); setActive(null); }}>{category.name[language]}</CatalogueCategoryLink>)}
        </div>
      </div>)}
    </div>
  </div>;
}
