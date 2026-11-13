import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";
import "./catalogue.css";
import "./inquiry-direction.css";
import "./rtl.css";
import "./home-division-hero.css";
import "./home-product-showcase.css";
import "./product-detail.css";
import "../components/site/site.css";
import { headers } from "next/headers";
import { siteLanguage } from "../lib/site-language";
import OkkiTracking from "../components/okki-tracking";

export const metadata: Metadata = {
  title: "ZHUDUO | Electrical Equipment & Modular Buildings",
  description: "Explore transformers, switchgear, substations and modular buildings with ZHUDUO. Compare product specifications and discuss your project requirements."
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const language = siteLanguage((await headers()).get("x-site-language") || undefined);
  return (
    <html lang={language} dir="ltr">
      <body>{children}<OkkiTracking preview={process.env.SITE_PREVIEW_MODE === "true"}/></body>
    </html>
  );
}
