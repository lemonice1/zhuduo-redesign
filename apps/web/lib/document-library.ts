import type { SiteLanguage } from "./site-language";

export const documentGroups = ["housing", "electrical"] as const;
export type DocumentGroup = typeof documentGroups[number];
export type DownloadDocument = { id: string; title: string; description: string; fileName: string; fileUrl: string; format: string; mime: string; sizeKb: number };
export type DocumentLibrary = { group: DocumentGroup; title: string; summary: string; documents: DownloadDocument[] };
export const documentCopy = {
  en: { housing: "Housing Documents", electrical: "Electrical Equipment Documents", intro: "Download product documents and technical files for modular housing and electrical equipment.", download: "Download", empty: "Documents will be available soon.", count: "documents" },
  fr: { housing: "Documents pour l’habitat modulaire", electrical: "Documents des équipements électriques", intro: "Téléchargez les documents produits et les fichiers techniques pour l’habitat modulaire et les équipements électriques.", download: "Télécharger", empty: "Les documents seront bientôt disponibles.", count: "documents" },
  ar: { housing: "وثائق المنازل المعيارية", electrical: "وثائق المعدات الكهربائية", intro: "نزّل وثائق المنتجات والملفات الفنية للمنازل المعيارية والمعدات الكهربائية.", download: "تنزيل", empty: "ستتوفر الوثائق قريبًا.", count: "وثائق" }
} satisfies Record<SiteLanguage, Record<string, string>>;

export const documentDownloadHref = (group: DocumentGroup, id: string, language: SiteLanguage) => `/api/documents/${group}/${id}?lang=${language}`;
