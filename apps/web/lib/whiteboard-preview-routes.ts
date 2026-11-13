import type { Route } from "next";
import type { SiteLanguage } from "./site-language";

export const previewProjectSlug = "australia-40ft-expandable-housing";
export const whiteboardHref = (path: string, language: SiteLanguage): Route => `/preview/whiteboard${path ? `/${path}` : ""}?lang=${language}` as Route;
