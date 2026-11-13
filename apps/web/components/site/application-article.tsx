import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import type { ApplicationContent } from "../../lib/application-content";
import type { SiteLanguage } from "../../lib/site-language";

export default function ApplicationArticle({ content, language }: { content: ApplicationContent; language: SiteLanguage }) {
  function mediaUrl(value: string, key: string) {
    const safe = defaultUrlTransform(value);
    if (!safe) return "";
    // Strapi's Markdown editor inserts upload paths relative to the CMS.
    if (/^\/?uploads\//i.test(safe)) return new URL(safe, content.mediaBaseUrl).href;
    if (key === "src" && !/^(https?:\/\/|\/(?!\/)|\.\.?\/)/i.test(safe)) return "";
    return safe;
  }

  return <section className="hp-section hp-application-article-section"><article className="hp-container hp-application-article" lang={language} dir={language === "ar" ? "rtl" : "ltr"}>
    {content.coverImageUrl && <img className="hp-application-cover" src={content.coverImageUrl} alt={content.coverImageAlt}/>}
    <div className="hp-markdown"><ReactMarkdown skipHtml urlTransform={mediaUrl} components={{
      img: ({ node, ...props }) => props.src ? <img {...props} loading="lazy"/> : null,
      a: ({ node, ...props }) => <a {...props} rel="noopener noreferrer"/>
    }}>{content.body}</ReactMarkdown></div>
  </article></section>;
}
