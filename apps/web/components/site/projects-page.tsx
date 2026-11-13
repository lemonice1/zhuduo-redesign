import Link from "next/link";
import type { ProjectCase } from "../../lib/content";
import type { SiteLanguage } from "../../lib/site-language";
import { siteCopy } from "./copy";
import { translate } from "../../lib/site-language";
import { projectDetailHref, validProjectSlug } from "../../lib/project-detail";
import type { Route } from "next";

export default function ProjectsPage({ path, language, cases }: { path: string; language: SiteLanguage; cases: ProjectCase[]; previewRoutes: boolean }) {
  const t = siteCopy[language];
  const leaf = path.split("/")[1];
  const references = leaf === "project-references";
  return <section className="hp-section hp-projects-page"><div className="hp-container">
    {cases.length && references ? <div className="hp-project-references">{cases.map(item => <article className="hp-project-reference" key={`${item.title}:${item.imageUrl}`}>
      <h2>{item.title}</h2><dl>{[[t.projectLocation, item.location], [t.projectProduct, item.productName], [t.projectQuantity, item.quantity]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </article>)}</div> : <ProjectEntries cases={cases} language={language}/>}
  </div></section>;
}

function ProjectEntries({ cases, language }: { cases: ProjectCase[]; language: SiteLanguage }) {
  const t = siteCopy[language];
  const tr = (text: string) => translate(language, text);
  const projectLabel = { en: "Project", fr: "Projet", ar: "مشروع" }[language];
  const entries: (ProjectCase | null)[] = cases.length ? cases : [null];
  return <div className="hp-project-list">{entries.map(item => {
    const href = item ? validProjectSlug(item.slug) ? projectDetailHref(item.slug, language) : null : `/preview/projects/sample-project?lang=${language}` as Route;
    return <article className={`hp-project-entry${item ? "" : " hp-project-entry-placeholder"}`} key={item ? `${item.title}:${item.imageUrl}` : "placeholder"}>
      <div className="hp-project-entry-copy">
        <span className="hp-project-entry-badge" dir="auto">{item ? projectLabel : t.projectPlaceholder}</span>
        <h2 dir="auto">{href ? <Link href={href}>{item?.title || t.projectsEmpty}</Link> : item?.title || t.projectsEmpty}</h2>
        {item ? <><p className="hp-project-entry-meta" dir="auto">{[item.location, item.productName, item.quantity].join(" · ")}</p>{item.summary && <p className="hp-project-entry-summary" dir="auto">{item.summary}</p>}</> : <p className="hp-project-entry-summary" dir="auto">{t.projectsEmptyNote}</p>}
        {href ? <Link className="hp-project-more" href={href} dir="ltr">
          <span className="hp-project-more-ring" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg></span><span className="hp-project-more-label" dir="auto">{tr("Learn more")}</span>
        </Link> : <button type="button" className="hp-project-more" aria-disabled="true" title={tr("Project details coming soon.")} dir="ltr">
          <span className="hp-project-more-ring" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg></span><span className="hp-project-more-label" dir="auto">{tr("Learn more")}</span>
        </button>}
      </div>
      {href ? <Link className="hp-project-entry-media" href={href} aria-label={item?.title || t.projectsEmpty}><img src={item?.imageUrl || "/products/company/d7-exterior-setting.webp"} alt={item?.title || t.referenceImage} loading="lazy"/>{!item && <span className="hp-reference-badge">{t.referenceImage}</span>}</Link> : <div className="hp-project-entry-media"><img src={item!.imageUrl} alt={item!.title} loading="lazy"/></div>}
    </article>;
  })}</div>;
}
