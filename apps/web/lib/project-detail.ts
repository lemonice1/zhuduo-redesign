import type { SiteLanguage } from "./site-language";
import type { Route } from "next";

export type ProjectImage = { url: string; alt: string; caption: string };
export type ProjectDetail = {
  slug: string; documentId?: string; title: string; summary: string; location: string; productName: string; quantity: string; application: string;
  gallery: ProjectImage[]; projectFacts: { label: string; value: string }[];
  detail: string; introImage: ProjectImage | null; features: string[];
  detailImages: ProjectImage[]; certificateImages: ProjectImage[];
  videoUrl: string; videoPoster?: string; productionText: string; productionImages: ProjectImage[];
  referenceImages: ProjectImage[]; shippingText: string; shippingImages: ProjectImage[];
  projectFaqs: { question: string; answer: string }[]; mediaBaseUrl: string; sample?: boolean;
};

export const validProjectSlug = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);
export const projectDetailHref = (slug: string, language: SiteLanguage): Route => `/projects/featured-projects/${encodeURIComponent(slug)}?lang=${language}` as Route;
export function projectInquirySource(project: Pick<ProjectDetail, "slug" | "documentId">) {
  const source = `project:/projects/featured-projects/${project.slug}`;
  // The existing inquiry contract limits source to 120 characters. Very long
  // slugs retain their exact identity through Strapi's stable document ID.
  return source.length <= 120 ? source : `project:${project.documentId || project.slug}`;
}

export const projectCopy = {
  en: { back: "Back to projects", inquiry: "Inquiry", overview: "Project introduction", features: "Project features", details: "Details", certificates: "Certificates", video: "Project video", production: "Production process", references: "Related project images", shipping: "Loading & transportation", faq: "Frequently asked questions", contact: "Tell us about your project", previous: "Previous image", next: "Next image", image: "View image", play: "Play video", sample: "Sample project — placeholder content", sampleNote: "This page demonstrates the layout. Text, images and video are placeholders; they do not describe a verified project. The inquiry form is a demonstration and does not store information.", certificatePlaceholder: "Certificate placeholder", location: "Location", product: "Product", quantity: "Quantity", application: "Application" },
  fr: { back: "Retour aux projets", inquiry: "Demande de renseignements", overview: "Présentation du projet", features: "Caractéristiques du projet", details: "Détails", certificates: "Certificats", video: "Vidéo du projet", production: "Processus de production", references: "Images de projets associés", shipping: "Chargement et transport", faq: "Questions fréquentes", contact: "Parlez-nous de votre projet", previous: "Image précédente", next: "Image suivante", image: "Voir l’image", play: "Lire la vidéo", sample: "Projet de démonstration — contenu provisoire", sampleNote: "Cette page illustre la mise en page. Les textes, images et vidéos sont provisoires et ne décrivent pas un projet vérifié. Le formulaire est une démonstration et n’enregistre aucune information.", certificatePlaceholder: "Emplacement de certificat", location: "Lieu", product: "Produit", quantity: "Quantité", application: "Application" },
  ar: { back: "العودة إلى المشاريع", inquiry: "استفسار", overview: "نبذة عن المشروع", features: "مميزات المشروع", details: "التفاصيل", certificates: "الشهادات", video: "فيديو المشروع", production: "مراحل الإنتاج", references: "صور مشاريع ذات صلة", shipping: "التحميل والنقل", faq: "الأسئلة الشائعة", contact: "أخبرنا عن مشروعك", previous: "الصورة السابقة", next: "الصورة التالية", image: "عرض الصورة", play: "تشغيل الفيديو", sample: "مشروع تجريبي — محتوى مؤقت", sampleNote: "تعرض هذه الصفحة نموذج التصميم. النصوص والصور والفيديو مواد مؤقتة ولا تصف مشروعًا موثقًا. نموذج الاستفسار تجريبي ولا يحفظ أي معلومات.", certificatePlaceholder: "موضع شهادة مؤقت", location: "الموقع", product: "المنتج", quantity: "الكمية", application: "الاستخدام" }
} as const;
