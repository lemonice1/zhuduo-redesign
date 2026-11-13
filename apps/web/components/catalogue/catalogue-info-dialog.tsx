"use client";

import LocalizedText from "../localized-text";

import { translate } from "../../lib/site-language";

import { useEffect, useId, useRef } from "react";
import type { CatalogueLanguage } from "../../lib/catalogue";
import ProductGallery from "../product-gallery";

export type CatalogueInfo = {
  kind: "product" | "category";
  title: string;
  inquiryValue: string;
  imageReference?: boolean;
  category: string;
  image?: string;
  summary: string;
  detail: string;
  options?: string[];
  galleryUrls?: string[];
  brochureUrl?: string;
};

export default function CatalogueInfoDialog({ info, language, onDismiss }: { info: CatalogueInfo | null; language: CatalogueLanguage; onDismiss: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const tr = (english: string) => translate(language, english);

  useEffect(() => {
    const node = dialog.current;
    if (!info || !node) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const position = { left: window.scrollX, top: window.scrollY };
    node.showModal();
    document.body.classList.add("modal-open");
    return () => {
      node.close();
      if (!document.querySelector("dialog[open]")) document.body.classList.remove("modal-open");
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      window.scrollTo({ ...position, behavior: "instant" });
    };
  }, [info]);

  return <dialog ref={dialog} className="pv-info-dialog" aria-labelledby={titleId} onKeyDown={event => {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]"));
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} onCancel={event => { event.preventDefault(); onDismiss(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onDismiss();
  }}>
    <button type="button" className="close" aria-label={tr("Close information")} onClick={onDismiss}>×</button>
    {info && <div className="pv-info-layout">
      <div className={`pv-info-image${info.image ? "" : " pv-image-pending"}`}>
        <ProductGallery key={info.inquiryValue} image={info.image} images={info.galleryUrls} title={info.title} language={language} />
      </div>
      <div className="pv-info-copy">
        <span className="eyebrow">{info.category}</span><h2 id={titleId}><LocalizedText text={info.title} language={language}/></h2><p className="pv-info-summary"><LocalizedText text={info.summary} language={language}/></p>{info.imageReference && <p className="pv-reference-note">{tr("Category reference image. Contact us to confirm models and configurations.")}</p>}
        <div className="pv-info-description"><h3>{info.kind === "product" ? tr("Product information") : tr("Category information")}</h3><p className="multiline"><LocalizedText text={info.detail} language={language}/></p></div>
        {!!info.options?.length && <div className="pv-info-options"><h3>{tr("Configuration and options")}</h3><ul>{info.options.map(option => <li key={option}><LocalizedText text={option} language={language}/></li>)}</ul></div>}
        {info.brochureUrl && <a className="product-brochure" href={info.brochureUrl} target="_blank" rel="noopener noreferrer">{tr("View product brochure (PDF)")} ↗</a>}
        <button type="button" className="btn primary pv-info-quote" data-catalogue-quote={info.inquiryValue} onClick={() => { dialog.current?.close(); onDismiss(); }}>{tr("Inquire about this product")} <span aria-hidden="true">↗</span></button>
      </div>
    </div>}
  </dialog>;
}
