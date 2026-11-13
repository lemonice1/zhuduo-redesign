"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import InquiryForm from "../inquiry-form";
import type { Product } from "../../lib/content";
import { projectCopy, projectInquirySource, type ProjectDetail, type ProjectImage } from "../../lib/project-detail";
import type { SiteLanguage } from "../../lib/site-language";
import { siteHref } from "../../lib/site-architecture";
import "./project-detail.css";

export function Gallery({ images, language }: { images: ProjectImage[]; language: SiteLanguage }) {
  const [active, setActive] = useState(0);
  const t = projectCopy[language];
  if (!images.length) return null;
  const selected = images[active] || images[0];
  const move = (offset: number) => setActive(index => (index + offset + images.length) % images.length);
  return <div className="prj-gallery" aria-label={t.image}>
    <div className="prj-gallery-main"><img src={selected.url} alt={selected.alt} fetchPriority="high"/>
      {images.length > 1 && <><button type="button" className="prj-gallery-prev" onClick={() => move(-1)} aria-label={t.previous}>‹</button><button type="button" className="prj-gallery-next" onClick={() => move(1)} aria-label={t.next}>›</button></>}
    </div>
    {images.length > 1 && <div className="prj-thumbnails">{images.map((image, index) => <button type="button" key={image.url} onClick={() => setActive(index)} aria-label={`${t.image} ${index + 1}`} aria-pressed={active === index}><img src={image.url} alt="" loading="lazy"/></button>)}</div>}
    <span className="prj-gallery-count" aria-live="polite" dir="ltr">{active + 1} / {images.length}</span>
    {selected.caption && <p className="prj-gallery-caption" dir="auto" aria-live="polite">{selected.caption}</p>}
  </div>;
}

function Images({ images, kind = "" }: { images: ProjectImage[]; kind?: string }) {
  return <div className={`prj-image-grid ${kind}`}>{images.map((image, index) => <figure key={`${image.url}:${index}`}><div className="prj-image-frame"><img src={image.url} alt={image.alt} loading="lazy"/></div>{image.caption && <figcaption dir="auto">{image.caption}</figcaption>}</figure>)}</div>;
}

export function ProjectVideo({ project, language }: { project: ProjectDetail; language: SiteLanguage }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const t = projectCopy[language];
  return <div className="prj-video">
    <video ref={video} controls playsInline preload="none" poster={project.videoPoster} aria-label={t.video} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}><source src={project.videoUrl}/></video>
    {!playing && <button type="button" aria-label={t.play} onClick={() => void video.current?.play().catch(() => setPlaying(false))}><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7-11-7Z"/></svg></button>}
  </div>;
}

export default function ProjectDetailPage({ project, language, products, directions, inquiryPreview, turnstileSiteKey }: { project: ProjectDetail; language: SiteLanguage; products: Product[]; directions: { value: string; title: string }[]; inquiryPreview: boolean; turnstileSiteKey: string }) {
  const t = projectCopy[language];
  const dir = language === "ar" ? "rtl" : "ltr";
  const [productType, setProductType] = useState("");
  const preview = Boolean(project.sample || inquiryPreview);
  const facts = [[t.location, project.location], [t.product, project.productName], [t.quantity, project.quantity], [t.application, project.application]].filter(([, value]) => value);
  const markdownUrl = (value: string, key: string) => {
    const safe = defaultUrlTransform(value);
    if (!safe) return "";
    if (/^\/?uploads\//i.test(safe)) return new URL(safe, project.mediaBaseUrl).href;
    if (key === "src" && !/^(https?:\/\/|\/(?!\/)|\.\.?\/)/i.test(safe)) return "";
    return safe;
  };
  return <article className="prj-page" lang={language} dir="ltr">
    <div className="hp-container prj-container">
      <Link className="hp-text-link prj-back" href={siteHref("projects/featured-projects", language)}>← <span dir={dir}>{t.back}</span></Link>
      {project.sample && <aside className="prj-sample" dir={dir}><strong>{t.sample}</strong><p>{t.sampleNote}</p></aside>}
      <section className={`prj-hero${project.gallery.length ? "" : " prj-hero-no-gallery"}`} aria-labelledby="project-title">
        <Gallery images={project.gallery} language={language}/>
        <div className="prj-info" dir={dir}><span className="hp-eyebrow">ZHUDUO / {language === "fr" ? "PROJETS" : language === "ar" ? "المشاريع" : "PROJECTS"}</span><h1 id="project-title">{project.title}</h1>{project.summary && <p>{project.summary}</p>}
          {(facts.length > 0 || project.projectFacts.length > 0) && <dl>{[...facts, ...project.projectFacts.map(row => [row.label, row.value])].map(([label, value], index) => <div key={index}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
          <a className="btn primary" href="#contact">{t.inquiry} <span aria-hidden="true">↓</span></a>
        </div>
      </section>
      {(project.detail || project.introImage) && <section className={`prj-section prj-intro${project.introImage ? "" : " prj-intro-text"}`} aria-labelledby="prj-overview">
        {project.introImage && <Images images={[project.introImage]}/>}
        <div dir={dir}><h2 id="prj-overview">{t.overview}</h2>{project.detail && <div className="hp-markdown"><ReactMarkdown skipHtml urlTransform={markdownUrl} components={{ img: ({ node, ...props }) => props.src ? <img {...props} loading="lazy"/> : null, a: ({ node, ...props }) => <a {...props} rel="noopener noreferrer"/> }}>{project.detail}</ReactMarkdown></div>}</div>
      </section>}
      {project.features.length > 0 && <section className="prj-section" dir={dir}><h2>{t.features}</h2><ul className="prj-features">{project.features.map((feature, index) => <li key={index}>{feature}</li>)}</ul></section>}
      {project.detailImages.length > 0 && <section className="prj-section"><h2 dir={dir}>{t.details}</h2><Images images={project.detailImages}/></section>}
      {project.certificateImages.length > 0 && <section className="prj-section"><h2 dir={dir}>{t.certificates}</h2><Images images={project.certificateImages} kind="prj-certificates"/></section>}
      {project.videoUrl && <section className="prj-section"><h2 dir={dir}>{t.video}</h2><ProjectVideo project={project} language={language}/></section>}
      {(project.productionText || project.productionImages.length > 0) && <section className="prj-section"><h2 dir={dir}>{t.production}</h2>{project.productionText && <p className="prj-prose" dir={dir}>{project.productionText}</p>}<Images images={project.productionImages} kind="prj-production"/></section>}
      {project.referenceImages.length > 0 && <section className="prj-section"><h2 dir={dir}>{t.references}</h2><Images images={project.referenceImages}/></section>}
      {(project.shippingText || project.shippingImages.length > 0) && <section className="prj-section"><h2 dir={dir}>{t.shipping}</h2>{project.shippingText && <p className="prj-prose" dir={dir}>{project.shippingText}</p>}<Images images={project.shippingImages}/></section>}
      {project.projectFaqs.length > 0 && <section className="prj-section prj-faq" dir={dir}><h2>{t.faq}</h2>{project.projectFaqs.map((faq, index) => <details key={index}><summary>{faq.question}<span aria-hidden="true">+</span></summary><p>{faq.answer}</p></details>)}</section>}
      <section className="prj-section prj-contact" id="contact" aria-labelledby="prj-contact-title"><h2 id="prj-contact-title" dir={dir}>{t.contact}</h2><div className="hp-inquiry-card">
        <InquiryForm products={products} directions={directions} activeApplication="General" productType={productType} setProductType={setProductType} language={language} preview={preview} turnstileSiteKey={preview ? "" : turnstileSiteKey} source={projectInquirySource(project)}/>
      </div></section>
    </div>
  </article>;
}
