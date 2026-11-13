"use client";

import LocalizedText from "./localized-text";

import { translate, type SiteLanguage } from "../lib/site-language";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { inquiryDirectionGroups, type InquiryDirection } from "../lib/inquiry-directions";
import type { Product } from "../lib/content";

export default function ProductDirectionPicker({ products, directions, language, value, onChange, error }: {
  products: Product[];
  directions: InquiryDirection[];
  language: SiteLanguage;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const id = useId();
  const tr = (english: string) => translate(language, english);
  const groups = useMemo(() => inquiryDirectionGroups(products, directions, language), [products, directions, language]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const focusSearch = useRef(false);
  const group = groups.find(item => item.value === active) || groups[0];
  const selected = groups.flatMap(item => [...item.categories, ...item.models]).find(item => item.value === value);
  const matches = (option: InquiryDirection) => option.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const sections = [
    { title: tr("PRODUCT CATEGORIES"), options: group?.categories.filter(matches) || [] },
    { title: tr("AVAILABLE MODELS"), options: group?.models.filter(matches) || [] }
  ];
  const count = sections.reduce((sum, section) => sum + section.options.length, 0);

  function close(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  }

  function show(withSearchFocus = false) {
    setActive(groups.find(item => [...item.categories, ...item.models].some(option => option.value === value))?.value || groups[0]?.value || "");
    setQuery("");
    focusSearch.current = withSearchFocus;
    setOpen(true);
  }

  function choose(option: string) {
    onChange(option);
    close(true);
  }

  useLayoutEffect(() => {
    if (!open || !panel.current || !trigger.current) return;
    const element = panel.current;
    const button = trigger.current;
    const dialog = button.closest("dialog");
    if (dialog && !dialog.open) { setOpen(false); return; }
    // Native popovers render above the enclosing dialog without being clipped
    // by its scrolling area. Fixed positioning also works in older browsers.
    if (typeof element.showPopover === "function") element.showPopover();
    const position = () => {
      const viewport = window.visualViewport;
      const topLimit = (viewport?.offsetTop || 0) + 10;
      const leftLimit = (viewport?.offsetLeft || 0) + 12;
      const bottomLimit = (viewport?.offsetTop || 0) + (viewport?.height || innerHeight) - 10;
      const rightLimit = (viewport?.offsetLeft || 0) + (viewport?.width || innerWidth) - 12;
      const rect = button.getBoundingClientRect();
      const dialogRect = dialog?.getBoundingClientRect();
      if (rect.bottom < Math.max(topLimit, dialogRect?.top || 0) || rect.top > Math.min(bottomLimit, dialogRect?.bottom || innerHeight)) { setOpen(false); return; }
      const width = Math.min(Math.max(rect.width, 296), rightLimit - leftLimit);
      const below = bottomLimit - rect.bottom - 6;
      const above = rect.top - topLimit - 6;
      element.style.width = `${width}px`;
      element.style.left = `${Math.max(leftLimit, Math.min(rect.right - width, rightLimit - width))}px`;
      element.style.maxHeight = `${Math.min(350, bottomLimit - topLimit)}px`;
      const desired = element.getBoundingClientRect().height;
      const useBelow = below >= desired || below >= above;
      element.style.maxHeight = `${Math.max(100, Math.min(350, useBelow ? below : above, bottomLimit - topLimit))}px`;
      const height = element.getBoundingClientRect().height;
      element.style.top = `${Math.max(topLimit, Math.min(useBelow ? rect.bottom + 6 : rect.top - height - 6, bottomLimit - height))}px`;
    };
    position();
    if (focusSearch.current) search.current?.focus({ preventScroll: true });
    const frame = requestAnimationFrame(() => {
      element.querySelector<HTMLElement>(".direction-option[aria-pressed=true]")?.scrollIntoView({ block: "nearest" });
    });
    const onClose = () => setOpen(false);
    const observer = new ResizeObserver(position);
    observer.observe(element);
    observer.observe(button);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    dialog?.addEventListener("close", onClose);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
      dialog?.removeEventListener("close", onClose);
      if (typeof element.hidePopover === "function" && element.matches(":popover-open")) element.hidePopover();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function optionKeys(event: KeyboardEvent<HTMLDivElement>) {
    const options = [...(panel.current?.querySelectorAll<HTMLButtonElement>(".direction-option") || [])];
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    if (["ArrowDown", "ArrowUp"].includes(event.key) && (index >= 0 || event.target === search.current)) {
      event.preventDefault();
      const next = index < 0 ? event.key === "ArrowDown" ? 0 : options.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      options[next]?.focus({ preventScroll: true });
      options[next]?.scrollIntoView({ block: "nearest" });
    } else if (["Home", "End"].includes(event.key) && index >= 0) {
      event.preventDefault();
      options[event.key === "Home" ? 0 : options.length - 1]?.focus();
    } else if (event.key === "Enter" && event.target === search.current) {
      event.preventDefault();
      options[0]?.click();
    }
  }

  return <div ref={root} className="inquiry-direction-field" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
  }} onKeyDown={event => {
    if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(true); }
  }}>
    <label id={`${id}-label`} htmlFor={`${id}-trigger`}>{tr("Product direction")}</label>
    <button ref={trigger} id={`${id}-trigger`} type="button" className={`direction-trigger${value ? "" : " is-placeholder"}`} data-field="productType" aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-panel` : undefined} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} onClick={() => open ? close() : show()} onKeyDown={event => {
      if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); show(true); }
    }}><span id={`${id}-value`}><LocalizedText text={selected?.title || value || tr("Select a starting point")} language={language}/></span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></button>
    <input type="hidden" name="productType" value={value}/>
    {error && <span id={`${id}-error`} className="field-error">{error}</span>}
    {open && <div ref={panel} id={`${id}-panel`} className="direction-panel" popover="manual" role="dialog" aria-labelledby={`${id}-label`} onKeyDown={optionKeys}>
      <div className="direction-tabs" role="tablist" aria-label={tr("Product divisions")} onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const index = groups.findIndex(item => item.value === group?.value);
        const next = event.key === "Home" ? 0 : event.key === "End" ? groups.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + groups.length) % groups.length;
        setActive(groups[next].value); setQuery("");
        event.currentTarget.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
      }}>
        {groups.map(item => <button key={item.value} id={`${id}-${item.value}`} type="button" role="tab" aria-selected={item.value === group?.value} aria-controls={`${id}-options`} tabIndex={item.value === group?.value ? 0 : -1} onClick={() => { setActive(item.value); setQuery(""); }}>
          {item.value !== "other" && <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">{item.value === "electrical" ? <path d="m9 1-6 8h4l-1 6 7-9H9l1-5Z"/> : <path d="m1.5 7 6.5-5 6.5 5M3 6v8h10V6M6.5 14V9h3v5"/>}</svg>}{item.title}
        </button>)}
      </div>
      <div className="direction-search"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><circle cx="6.8" cy="6.8" r="4.5"/><path d="m10.2 10.2 3.5 3.5"/></svg><input ref={search} type="search" dir="auto" value={query} onChange={event => setQuery(event.target.value)} placeholder={tr("Search categories or models")} aria-label={tr("Search categories or models")} autoComplete="off"/></div>
      <div key={group?.value} id={`${id}-options`} className="direction-options" role="tabpanel" aria-labelledby={group ? `${id}-${group.value}` : undefined}>
        {sections.filter(section => section.options.length).map(section => <div className="direction-section" key={section.title} role="group" aria-label={section.title}>
          <div className="direction-section-title"><span>{section.title}</span><span>{String(section.options.length).padStart(2, "0")}</span></div>
          {section.options.map(option => <button key={option.value} type="button" className="direction-option" aria-pressed={option.value === value} onClick={() => choose(option.value)}><span><LocalizedText text={option.title} language={language}/></span>{option.value === value && <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg>}</button>)}
        </div>)}
        {!count && <p className="direction-empty">{tr("No matching categories or models. Try another search.")}</p>}
      </div>
      <div className="direction-footer"><span role="status">{translate(language, "{categories} categories · {models} models", { categories: sections[0].options.length, models: sections[1].options.length })}</span><button type="button" onClick={() => choose("")}>{tr("Clear selection")}</button></div>
    </div>}
  </div>;
}
