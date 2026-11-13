import { NextResponse, type NextRequest } from "next/server";
import { siteLanguage } from "./lib/site-language";

export function middleware(request: NextRequest) {
  if (["zh", "zh-Hans"].includes(request.nextUrl.searchParams.get("lang") || "")) {
    const url = request.nextUrl.clone();
    url.searchParams.set("lang", "en");
    return NextResponse.redirect(url, 308);
  }
  const headers = new Headers(request.headers);
  headers.set("x-site-language", siteLanguage(request.nextUrl.searchParams.get("lang") || undefined));
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!api|_next|fonts|brand|products/company|living|.*\\.[^/]+$).*)"] };
