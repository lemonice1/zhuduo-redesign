"use client";

import { useState } from "react";
import { translate, type SiteLanguage } from "../lib/site-language";

export default function ProductGallery({ image, images = [], title, language }: { image?: string; images?: string[]; title: string; language: SiteLanguage }) {
  const pictures = [...new Set([image, ...images].filter((url): url is string => Boolean(url)))];
  const [selected, setSelected] = useState(0);
  if (!pictures.length) return <div className="product-gallery-empty">{translate(language, "Product image unavailable")}</div>;
  return <div className="product-gallery">
    <div className="product-gallery-main"><img src={pictures[selected] || pictures[0]} alt={`${title}${selected ? ` — ${selected + 1}` : ""}`} /></div>
    {pictures.length > 1 && <div className="product-gallery-thumbnails" role="group" aria-label={translate(language, "Product gallery")}>
      {pictures.map((url, index) => <button key={url} type="button" aria-label={translate(language, "View image {number}", { number: index + 1 })} aria-pressed={selected === index} onClick={() => setSelected(index)}><img src={url} alt="" loading="lazy" /></button>)}
    </div>}
  </div>;
}
