import { Fragment } from "react";
import type { SiteLanguage } from "../lib/site-language";

// Isolate measurements and model codes so RTL paragraphs keep the original
// order of dimensions, voltage ratios, ranges, units and Latin identifiers.
export default function LocalizedText({ text, language }: { text: string; language: SiteLanguage }) {
  if (language !== "ar") return <>{text}</>;
  const parts = text.split(/([A-Za-z0-9]+(?:[ \t.,/×²³()%+–−-]*[A-Za-z0-9]+)*[²³%]?)/g);
  return <span className="localized-text" dir="rtl">{parts.map((part, index) => index % 2 ? <bdi dir="ltr" key={index}>{part}</bdi> : <Fragment key={index}>{part}</Fragment>)}</span>;
}
