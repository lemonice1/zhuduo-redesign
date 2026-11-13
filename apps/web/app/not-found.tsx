import Link from "next/link";
import { headers } from "next/headers";
import { siteLanguage, translate } from "../lib/site-language";

export default async function NotFound() {
  const language = siteLanguage((await headers()).get("x-site-language") || undefined);
  return <main className="container section unavailable">
    <span className="eyebrow">ZHUDUO · 404</span>
    <h1>{translate(language, "Page not found.")}</h1>
    <p>{translate(language, "This page may have moved. Return to the homepage to continue browsing.")}</p>
    <Link className="btn primary" href={`/?lang=${language}`}>{translate(language, "Back to home")}</Link>
  </main>;
}
