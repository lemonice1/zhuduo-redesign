"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import type { HomepageContent, Product } from "../../../lib/content";
import { createSiteArchitecture, siteHref } from "../../../lib/site-architecture";
import { projectCopy, projectInquirySource, type ProjectDetail, type ProjectImage } from "../../../lib/project-detail";
import { translate, type SiteLanguage } from "../../../lib/site-language";
import { whiteboardHref } from "../../../lib/whiteboard-preview-routes";
import LanguagePicker from "../../language-picker";
import InquiryForm from "../../inquiry-form";
import ProductGallery from "../../product-gallery";
import { ProductFaq, productFacts } from "../../catalogue/product-detail-page";
import { Gallery, ProjectVideo } from "../../site/project-detail-page";
import CountUpNumber from "../../site/count-up-number";
import Chatbox from "../../site/chatbox";
import { siteCopy } from "../../site/copy";
import { whiteboardCopy } from "../copy";
import Template from "./template";
import VisualRuntime from "./visual-runtime";
import "./zhuduo-adapter.css";

type Props = {
  content: HomepageContent; project: ProjectDetail; product?: Product; language: SiteLanguage;
  view: "home" | "catalogue" | "product" | "projects" | "project" | "about";
  collection?: string;
};
type Architecture = ReturnType<typeof createSiteArchitecture>;
const projectImage = "/projects/design-preview/australia-project-cover.webp";
const electricalImage = "/brand/hero-electrical-equipment.webp";
const housingMenuImage = "/brand/modular-housing-menu.webp";
const companyAddress = "Floor 30, Block C, Tower 2, Wangjing SOHO\nNo. 1 Futong East Street, Chaoyang District\nBeijing 100102, China";

function Spacer({ large = false }: { large?: boolean }) {
  return <div className={`spacer-component${large ? " w-variant-aea45f07-8b30-d181-0430-911625064b03" : ""}`} data-wf--spacer--settings-size={large ? "large" : "main"}/>;
}
function Editorial({ children }: { children: ReactNode }) {
  return <Template name="detailBody" slots={{ body: <div className="zd-editorial" dir="auto">{children}</div> }}/>;
}
function Heading({ children }: { children: ReactNode }) {
  return <h2 className="heading-text" dir="auto">{children}</h2>;
}
function Images({ images, certificates = false }: { images: ProjectImage[]; certificates?: boolean }) {
  if (!images.length) return null;
  return <section className={`section zd-reference-images${certificates ? " zd-certificate-images" : ""}`}><div className="container"><div className="row row-gap-column">{images.map((image, index) => <Template key={`${image.url}:${index}`} name="detailImage" values={{ image: image.url, title: image.alt || image.caption }}/>)}</div></div></section>;
}

function CompanyFilm({ language, hero = false }: { language: SiteLanguage; hero?: boolean }) {
  const player = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const t = whiteboardCopy[language];
  useEffect(() => {
    const video = player.current;
    if (!hero || !video) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setAutoplay(!motion.matches);
      if (motion.matches) video.pause();
      else if (video.dataset.userPaused !== "true") {
        video.muted = true;
        void video.play().catch(() => {});
      }
    };
    update();
    motion.addEventListener("change", update);
    return () => { motion.removeEventListener("change", update); video.pause(); };
  }, [hero]);
  return <div className={`zd-film${hero ? " zd-film-hero" : ""}`}>
    <video ref={player} className={hero ? "video_source" : ""} controls={hero ? !autoplay : playing} autoPlay={autoplay} muted={hero} loop={hero} playsInline preload={hero ? "metadata" : "none"} poster="/videos/zhuduo-company-introduction-poster.webp" aria-label={t.video} onPlay={event => { delete event.currentTarget.dataset.userPaused; setPlaying(true); }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}>
      <source src="/videos/zhuduo-company-introduction.mp4" type="video/mp4"/>
    </video>
    {!playing && <button className="zd-film-play" type="button" onClick={() => { if (player.current) delete player.current.dataset.userPaused; void player.current?.play().catch(() => setPlaying(false)); }} aria-label={t.play}><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m9 5 11 7-11 7Z"/></svg><span className="u-sr-only">{t.video}</span></button>}
    {playing && autoplay && <button className="zd-film-pause" type="button" onClick={() => { if (player.current) { player.current.dataset.userPaused = "true"; player.current.pause(); } }} aria-label={t.pause}><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zm6 0h4v14h-4z"/></svg></button>}
  </div>;
}

function ServiceFilm({ src, poster }: { src: string; poster: string }) {
  const player = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = player.current;
    if (!video) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const update = () => {
      if (visible && !motion.matches && !document.hidden) {
        video.muted = true;
        void video.play().catch(() => {});
      } else video.pause();
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer.observe(video);
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      video.pause();
    };
  }, []);
  return <video ref={player} className="u-img-cover zd-service-video" muted loop playsInline preload="none" poster={poster} aria-hidden="true">
    <source src={src} type="video/mp4"/>
  </video>;
}

function Contact({ content, architecture, language, product, project }: { content: HomepageContent; architecture: Architecture; language: SiteLanguage; product?: Product; project?: ProjectDetail }) {
  const [productType, setProductType] = useState(product?.slug || "");
  const t = whiteboardCopy[language];
  return <section className="section zd-contact" id="contact" aria-labelledby="zd-contact-title"><Spacer large/><div className="container"><div className="row row-gap-column">
    <div className="col col-lg-5 col-sm-12" dir="auto"><div className="eyebrow">{t.contactTop}</div><h2 className="heading-text" id="zd-contact-title">{t.contactOne}<br/><em>{t.contactTwo}</em></h2><p>{t.contactNote}</p><p className="zd-demo-note">{t.demo}</p></div>
    <div className="col col-lg-6 col-sm-12 zd-form"><InquiryForm products={content.products} activeApplication="General" productType={productType} setProductType={setProductType} language={language} preview directions={architecture.directions(language)} source={project ? projectInquirySource(project) : product ? `product:${product.slug}` : "design-preview:whiteboard"}/></div>
  </div></div><Spacer large/></section>;
}

function ProductCard({ product, architecture, language }: { product: Product; architecture: Architecture; language: SiteLanguage }) {
  const category = architecture.divisions.flatMap(division => division.categories).find(row => row.slug === architecture.productCategory(product));
  return <Template name="card" values={{ title: product.title, summary: product.summary, category: category?.name[language] || product.eyebrow, image: product.imageUrl, href: whiteboardHref(`products/${product.slug}`, language), kind: "product" }}/>;
}

function Credentials({ content, language }: { content: HomepageContent; language: SiteLanguage }) {
  const certificates = content.certificates?.length ? content.certificates : ["9001", "14001", "45001"].map(number => ({ title: `ISO ${number}`, url: `/certifications/iso-${number}.jpg`, imageUrl: `/certifications/iso-${number}.jpg` }));
  return <Template name="credentials" values={{ certNote: whiteboardCopy[language].certNote }} slots={{ credentials: certificates.map(item => <Template name="credential" key={item.url} values={{ title: item.title, image: item.imageUrl || item.url, href: item.url }}/> ) }}/>;
}

function Stats({ content, language }: { content: HomepageContent; language: SiteLanguage }) {
  const t = whiteboardCopy[language];
  return <Template name="stats" values={{
    title: "ZHUDUO", statLabel0: t.founded, statLabel1: t.factory, statLabel2: t.countries,
    statNote0: t.housingNote, statNote1: t.introTop, statNote2: t.electricalNote,
    statImage0: content.settings?.factoryImageUrl || "/projects/design-preview/expandable-production-assembly.webp",
    statImage1: "/projects/design-preview/expandable-production-frame.webp", statImage2: projectImage
  }} slots={{
    stat0: <CountUpNumber value={content.settings?.foundedYear ?? 2008}/>,
    stat1: <><CountUpNumber value={content.settings?.factoryArea ?? 100000} grouping/><span className="zd-stat-unit"> ㎡</span></>,
    stat2: <><CountUpNumber value={content.settings?.exportMarkets ?? 100}/>+</>
  }}/>;
}

function Home({ content, project, architecture, language }: Props & { architecture: Architecture }) {
  const t = whiteboardCopy[language];
  const housing = architecture.products("modular-buildings", content.products);
  const selected = [housing.find(item => item.slug === "expandable-40ft") || housing[0], housing.find(item => item.slug === "space-capsule-d7") || housing[1]].filter((item): item is Product => Boolean(item));
  const cards = [...new Map(selected.map(product => [product.slug, product])).values()];
  const featureImages = [project.gallery[0]?.url || projectImage, ...project.productionImages.map(image => image.url), project.introImage?.url || projectImage];
  return <>
    <Template name="hero" values={{ heroOne: t.heroOne, heroTwo: t.heroTwo, heroNote: t.heroNote }} slots={{ film: <CompanyFilm language={language} hero/> }}/>
    <Template name="services" values={{ servicesTitle: t.entryTitle,
      service0: t.housing, serviceNote0: t.housingNote, serviceHref0: `${whiteboardHref("products", language)}&collection=modular-buildings`,
      service1: t.electrical, serviceNote1: t.electricalNote, serviceHref1: `${whiteboardHref("products", language)}&collection=electrical`
    }} slots={{
      serviceMedia0: <ServiceFilm src="/videos/zhuduo-modular-buildings-background.mp4" poster="/videos/zhuduo-modular-buildings-background-poster.webp"/>,
      serviceMedia1: <ServiceFilm src="/videos/zhuduo-electrical-equipment-background.mp4" poster="/videos/zhuduo-electrical-equipment-background-poster.webp"/>
    }}/>
    <Credentials content={content} language={language}/>
    <section className="section" id="collections"><Spacer/><div className="container"><div className="row">
      {cards.map(product => <div className="col col-lg-6 col-md-12" key={product.slug}><ProductCard product={product} architecture={architecture} language={language}/></div>)}
      <div className="col col-lg-12"><Template name="feature" values={{ featureLabel0: t.project, featureLabel2: "ZHUDUO", featureTitle: project.title, featureAction: t.projectRead, featureHref: whiteboardHref(`projects/${project.slug}`, language), ...Object.fromEntries([0, 1, 2, 3].map(index => [`featureImage${index}`, featureImages[index] || projectImage])) }}/></div>
    </div></div><Spacer/></section>
    <Stats content={content} language={language}/>
    <Template name="featureHero" values={{ title: t.dubai, summary: content.settings?.exhibitionName || "Big 5 Global 2026" }} slots={{ gallery: <a href={whiteboardHref("about", language)} className="zd-exhibition"><img src="/brand/big-5-global-2026.png" alt={content.settings?.exhibitionName || "Big 5 Global 2026"} loading="lazy"/></a> }}/>
  </>;
}

function Catalogue({ content, project, architecture, language, collection, projects = false }: Props & { architecture: Architecture; projects?: boolean }) {
  const t = whiteboardCopy[language];
  const categories = architecture.divisions.flatMap(division => division.categories);
  const category = categories.find(row => row.slug === collection);
  const products = category ? content.products.filter(product => architecture.productCategory(product) === category.slug) : collection && architecture.divisions.some(row => row.slug === collection) ? architecture.products(collection, content.products) : content.products;
  const activeDivision = architecture.divisions.find(row => row.slug === collection || row.categories.some(item => item.slug === collection));
  const filters = [{ key: "", title: t.collection }, ...architecture.divisions.map(row => ({ key: row.slug, title: row.name[language] })), ...(activeDivision?.categories || []).filter(row => content.products.some(product => architecture.productCategory(product) === row.slug)).map(row => ({ key: row.slug, title: row.name[language] }))];
  const cases = content.cases?.length ? content.cases : [{ ...project, imageUrl: project.gallery[0]?.url || projectImage }];
  return <><h1 className="u-sr-only">{projects ? t.project : t.collection}</h1><div className="zd-listing-top"/>
    <Template name="listing" slots={{
      filters: projects ? <Template name="filter" values={{ href: whiteboardHref("projects", language), title: t.project, current: "w--current" }}/> : filters.map(item => <Template name="filter" key={item.key} values={{ href: `${whiteboardHref("products", language)}${item.key ? `&collection=${encodeURIComponent(item.key)}` : ""}`, title: item.title, current: (collection || "") === item.key ? "w--current" : "" }}/>),
      cards: projects ? cases.map((item, index) => <div className="col col-lg-6 col-sm-12 w-dyn-item" role="listitem" key={item.slug || index}><Template name="card" values={{ title: item.title, summary: item.summary, category: item.location, image: item.imageUrl, href: item.slug ? whiteboardHref(`projects/${item.slug}`, language) : "", kind: "project" }}/></div>) : products.map(product => <div className="col col-lg-6 col-sm-12 w-dyn-item" role="listitem" key={product.slug}><ProductCard product={product} architecture={architecture} language={language}/></div>)
    }}/>
  </>;
}

function ProductPage({ product, architecture, language }: { product: Product; architecture: Architecture; language: SiteLanguage }) {
  const t = whiteboardCopy[language];
  const tr = (value: string) => translate(language, value);
  const facts = productFacts(product.detail);
  const description = product.detail.split(/\r?\n/).filter(line => line.trim() && !/^([^:：]{1,90})[:：]\s*(.+)$/.test(line.trim())).join("\n") || product.summary;
  const category = architecture.divisions.flatMap(division => division.categories).find(row => row.slug === architecture.productCategory(product));
  const division = architecture.divisions.find(row => row.categories.some(item => item.slug === category?.slug));
  return <>
    <Template name="detailHero" values={{ title: product.title, summary: product.summary }} slots={{ gallery: <ProductGallery image={product.imageUrl} images={product.galleryUrls} title={product.title} language={language}/> }}/>
    <Template name="detailFacts" values={{ factLabel0: tr("Product"), fact0: category?.name[language] || product.category, factLabel1: tr("Product information"), fact1: division?.name[language] || "ZHUDUO", factLabel2: tr("Inquiry"), fact2: t.contactNote }}/>
    <Editorial><a className="zd-text-link" href={`${whiteboardHref("products", language)}&collection=${category?.slug || ""}`}>← {t.productBack}</a><Heading>{tr("Product overview")}</Heading><p className="zd-multiline">{description}</p>{product.options.length > 0 && <ul>{product.options.map(option => <li key={option}>{option}</li>)}</ul>}
      {facts.length > 0 && <><Heading>{tr("Product specifications")}</Heading><dl className="zd-specifications">{facts.map((fact, index) => <div key={index}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl></>}
      {product.brochureUrl && <p><a href={product.brochureUrl} target="_blank" rel="noopener noreferrer">{tr("Download brochure")} ↗</a></p>}<a className="zd-text-link" href="#contact">{t.request} ↓</a>
    </Editorial>
    <Editorial><ProductFaq language={language} electrical={division?.slug === "electrical"} categoryHref={whiteboardHref("products", language)} productFaqs={product.productFaqs}/></Editorial>
  </>;
}

function ProjectPage({ project, language }: { project: ProjectDetail; language: SiteLanguage }) {
  const t = projectCopy[language];
  const markdownUrl = (value: string, key: string) => {
    const safe = defaultUrlTransform(value);
    if (!safe) return "";
    if (/^\/?uploads\//i.test(safe)) return new URL(safe, project.mediaBaseUrl).href;
    if (key === "src" && !/^(https?:\/\/|\/(?!\/)|\.\.?\/)/i.test(safe)) return "";
    return safe;
  };
  return <>
    <Template name="detailHero" values={{ title: project.title, summary: project.summary }} slots={{ gallery: <Gallery images={project.gallery} language={language}/> }}/>
    <Template name="detailFacts" values={{ factLabel0: t.location, fact0: project.location, factLabel1: t.product, fact1: project.productName, factLabel2: t.quantity, fact2: project.quantity }}/>
    <Editorial><a className="zd-text-link" href={whiteboardHref("projects", language)}>← {t.back}</a><Heading>{t.overview}</Heading>
      <ReactMarkdown skipHtml urlTransform={markdownUrl} components={{ img: ({ node, ...props }) => props.src ? <img {...props} loading="lazy"/> : null, a: ({ node, ...props }) => <a {...props} rel="noopener noreferrer"/> }}>{project.detail}</ReactMarkdown>
      {project.projectFacts.length > 0 && <dl className="zd-specifications">{project.projectFacts.map((row, index) => <div key={index}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>}
      {project.features.length > 0 && <><Heading>{t.features}</Heading><ul>{project.features.map((feature, index) => <li key={index}>{feature}</li>)}</ul></>}
      <a className="zd-text-link" href="#contact">{t.inquiry} ↓</a>
    </Editorial>
    <Images images={[...(project.introImage ? [project.introImage] : []), ...project.detailImages]}/>
    <Images images={project.certificateImages} certificates/>
    {project.videoUrl && <Editorial><Heading>{t.video}</Heading><ProjectVideo project={project} language={language}/></Editorial>}
    {(project.productionText || project.productionImages.length > 0) && <><Editorial><Heading>{t.production}</Heading><p>{project.productionText}</p></Editorial><Images images={project.productionImages}/></>}
    {project.referenceImages.length > 0 && <><Editorial><Heading>{t.references}</Heading></Editorial><Images images={project.referenceImages}/></>}
    {(project.shippingText || project.shippingImages.length > 0) && <><Editorial><Heading>{t.shipping}</Heading><p>{project.shippingText}</p></Editorial><Images images={project.shippingImages}/></>}
    {project.projectFaqs.length > 0 && <Editorial><Heading>{t.faq}</Heading>{project.projectFaqs.map((faq, index) => <details key={index}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</Editorial>}
  </>;
}

function About({ content, language }: { content: HomepageContent; language: SiteLanguage }) {
  const t = whiteboardCopy[language];
  return <><Template name="aboutHero" values={{ aboutTitle: t.introAction }}/>
    <Editorial><Heading>{content.settings?.siteName || "ZHUDUO"}</Heading><p className="zd-multiline">{content.settings?.companyIntro || siteCopy[language].aboutPageDescription}</p></Editorial>
    <section className="section"><div className="container"><CompanyFilm language={language}/></div></section>
    <Stats content={content} language={language}/><Credentials content={content} language={language}/>
    <Editorial><Heading>{t.contact}</Heading><p>{t.company}</p><p className="zd-multiline">{content.settings?.companyAddress || companyAddress}</p></Editorial>
  </>;
}

export default function OriginalWhiteboardSite(props: Props) {
  const { content, project, product, language, view } = props;
  const root = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const architecture = useMemo(() => createSiteArchitecture(content.productCategories), [content.productCategories]);
  const t = whiteboardCopy[language];
  const email = content.settings?.contactEmail || "sales@bjzdbuilding.com";
  const whatsapp = (content.settings?.whatsappNumber || "8618610537088").replace(/\D/g, "");
  const navigation = [{ title: t.home, path: "" }, { title: t.collection, path: "products" }, { title: t.project, path: "projects" }, { title: t.introAction, path: "about" }];
  const companyNavigation = architecture.navigation.filter(item => ["applications", "projects", "resources", "about"].includes(item.slug));
  const footerLinks = (items: { title: string; href: string }[]) => items.map(item => <Template name="footerLink" key={item.href} values={item}/>);
  return <><div className={`wbr-preview zd-view-${view}`} ref={root} lang={language} dir="ltr" id="zd-top">
    <link rel="stylesheet" href="/whiteboard-original/reference.css"/>
    <a className="zd-skip-link" href="#zd-main">{t.explore}</a>
    <div className="page-wrapper">
    <Template name="nav" values={{ homeHref: whiteboardHref("", language), email, productLabel: t.collection, companyLabel: "ZHUDUO", allProducts: t.collection, catalogueHref: whiteboardHref("products", language), tagline: t.heroNote, menuNote: t.menuNote, inquiryLabel: t.request, menuLabel: t.menu, closeLabel: t.close }} slots={{
      navProducts: architecture.divisions.map(division => <Template name="navProduct" key={division.slug} values={{ title: division.name[language], image: division.slug === "electrical" ? electricalImage : housingMenuImage, href: `${whiteboardHref("products", language)}&collection=${division.slug}` }}/>),
      navCompany: companyNavigation.map(item => <Template name="navCompany" key={item.slug} values={{ title: item.name[language], image: item.slug === "projects" ? project.gallery[0]?.url || projectImage : "/videos/zhuduo-company-introduction-poster.webp", href: ["projects", "about"].includes(item.slug) ? whiteboardHref(item.slug, language) : siteHref(item.slug, language) }}/>),
      language: <LanguagePicker language={language} openOnHover onChange={next => { const url = new URL(window.location.href); url.searchParams.set("lang", next); window.location.assign(url.href); }}/>
    }}/>
    <main className="page-wrap" id="zd-main"><div className="page-main">
      {view === "home" && <Home {...props} architecture={architecture}/>}
      {(view === "catalogue" || view === "projects") && <Catalogue {...props} architecture={architecture} projects={view === "projects"}/>}
      {view === "product" && product && <ProductPage product={product} architecture={architecture} language={language}/>}
      {view === "project" && <ProjectPage project={project} language={language}/>}
      {view === "about" && <About content={content} language={language}/>}
      <Contact content={content} architecture={architecture} language={language} product={product} project={view === "project" ? project : undefined}/>
    </div></main>
    <Template name="footer" values={{ companyName: t.company, address: content.settings?.companyAddress || companyAddress, demoNote: `${t.preview} · ${t.demo}`, year: String(new Date().getFullYear()), linksLabel: t.navigation, contactLabel: t.contact }} slots={{
      footerLinks0: footerLinks(navigation.map(item => ({ title: item.title, href: whiteboardHref(item.path, language) }))),
      footerLinks1: footerLinks([{ title: email, href: `mailto:${email}` }, { title: "WhatsApp", href: `https://api.whatsapp.com/send?phone=${whatsapp}` }, { title: t.request, href: "#contact" }]),
      footerLinks2: footerLinks([{ title: t.current, href: siteHref("", language) }, { title: t.backTop, href: "#zd-top" }])
    }}/>
    </div>
    <VisualRuntime root={root}/>
  </div><Chatbox language={language} pathname={pathname} productType={product?.slug} preview/></>;
}
