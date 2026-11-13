import { documentCopy, documentDownloadHref, documentGroups, type DocumentLibrary } from "../../lib/document-library";
import type { SiteLanguage } from "../../lib/site-language";

export default function TechnicalDocuments({ libraries, language }: { libraries: DocumentLibrary[]; language: SiteLanguage }) {
  const t = documentCopy[language];
  return <section className="hp-section hp-technical-documents"><div className="hp-container hp-library-grid">
    {documentGroups.map(group => {
      const library = libraries.find(item => item.group === group);
      const documents = library?.documents || [];
      return <article key={group} className="hp-library-card" data-document-group={group}>
        <header><svg className="hp-library-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 12h8M8 16h8"/></svg><h2 dir="auto">{library?.title || t[group]}</h2>{library?.summary && <p dir="auto">{library.summary}</p>}<span className="hp-library-count">{documents.length} {t.count}</span></header>
        {documents.length ? <ul className="hp-library-list">{documents.map(document => <li key={document.id}>
          <div className="hp-library-document-copy"><h3 dir="auto">{document.title}</h3>{document.description && <p dir="auto">{document.description}</p>}<span className="hp-file-meta" dir="ltr">{document.format}{document.sizeKb > 0 ? ` · ${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(document.sizeKb >= 1024 ? document.sizeKb / 1024 : document.sizeKb)} ${document.sizeKb >= 1024 ? "MB" : "KB"}` : ""}</span></div>
          <a className="hp-document-download" href={documentDownloadHref(group, document.id, language)} download={document.fileName}>{t.download}<span aria-hidden="true">↓</span></a>
        </li>)}</ul> : <p className="hp-library-empty" dir="auto">{t.empty}</p>}
      </article>;
    })}
  </div></section>;
}
