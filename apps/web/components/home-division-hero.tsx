import Link from "next/link";
import { catalogueHref, divisions } from "../lib/catalogue";
import { translate, type SiteLanguage } from "../lib/site-language";

const collections = [
  {
    slug: "modular-housing",
    image: "/products/company/d7-exterior-setting.webp",
    eyebrow: "MODULAR LIVING",
    action: "Explore modular housing"
  },
  {
    slug: "electrical",
    image: "/brand/hero-transformer-clean.webp",
    eyebrow: "ELECTRICAL SYSTEMS",
    action: "Explore electrical equipment"
  }
] as const;

export default function HomeDivisionHero({ language, previewRoutes = false }: { language: SiteLanguage; previewRoutes?: boolean }) {
  const tr = (text: string) => translate(language, text);
  return <section className="home-division-hero" id="home" aria-labelledby="division-hero-title">
    <h1 className="division-hero-heading" id="division-hero-title">{tr("Choose your product collection")}</h1>
    {collections.map((collection, index) => {
      const division = divisions.find(item => item.slug === collection.slug)!;
      const titleId = `hero-${collection.slug}-title`;
      const descriptionId = `hero-${collection.slug}-description`;
      return <Link key={collection.slug} href={catalogueHref(collection.slug, undefined, language, undefined, previewRoutes)}
        className={`division-hero-panel division-hero-${collection.slug}`} aria-labelledby={titleId} aria-describedby={descriptionId}>
        <img className="division-hero-image" src={collection.image} alt="" fetchPriority="high" decoding="async" />
        <div className="division-hero-copy">
          <span className="division-hero-eyebrow"><span>{String(index + 1).padStart(2, "0")}</span><span aria-hidden="true">/</span><span>{tr(collection.eyebrow)}</span></span>
          <h2 id={titleId}>{division.name[language]}</h2>
          <p id={descriptionId}>{division.description[language]}</p>
          <span className="division-hero-action"><span>{tr(collection.action)}</span><span className="division-hero-arrow" aria-hidden="true">↗</span></span>
        </div>
      </Link>;
    })}
  </section>;
}
