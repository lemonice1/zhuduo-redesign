import arabic from "./site-messages.ar.json";
import french from "./site-messages.fr.json";

export type SiteLanguage = "en" | "ar" | "fr";
export const siteLanguage = (value?: string): SiteLanguage => value === "ar" || value === "fr" ? value : "en";
const messages: Record<Exclude<SiteLanguage, "en">, Record<string, string>> = { ar: arabic, fr: french };
export function translate(language: SiteLanguage, english: string, values: Record<string, string | number> = {}): string {
  const text = language === "en" ? english : messages[language][english] || english;
  return text.replace(/\{(\w+)\}/g, (placeholder, key: string) => values[key] === undefined ? placeholder : String(values[key]));
}
