"use client";

import { useEffect, useState } from "react";
import { siteLanguage, translate, type SiteLanguage } from "../lib/site-language";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const [language, setLanguage] = useState<SiteLanguage>("en");
  useEffect(() => { setLanguage(siteLanguage(new URLSearchParams(window.location.search).get("lang") || undefined)); }, []);
  return <main className="container section unavailable" role="alert">
    <span className="eyebrow">ZhuDuo</span>
    <h1>{translate(language, "A brief pause.")}</h1>
    <p>{translate(language, "Our collection is temporarily unavailable. Please try again shortly.")}</p>
    <button className="btn primary" onClick={reset}>{translate(language, "Try again")} ↗</button>
  </main>;
}
