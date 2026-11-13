"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { preserveCatalogueScrollRange } from "../../lib/catalogue-scroll";

type CategoryLinkProps = Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> & { href: Route };

export default function CatalogueCategoryLink({ href, prefetch, scroll, ...props }: CategoryLinkProps) {
  const pathname = usePathname();
  const divisionPath = pathname.match(/^(?:\/preview)?\/products\/[^/]+/)?.[0];
  const targetPath = href.split("?")[0];
  const isCatalogue = /^(?:\/preview)?\/products\/[^/]+(?:\/[^/]+)?\/?$/.test(pathname);
  const withinDivision = Boolean(isCatalogue && divisionPath && (targetPath === divisionPath || targetPath.startsWith(`${divisionPath}/`)));

  return <Link {...props} href={href} prefetch={withinDivision ? false : prefetch} scroll={scroll ?? !withinDivision} onNavigate={event => {
    if (!withinDivision) return;
    event.preventDefault();
    preserveCatalogueScrollRange();
    // Keep the catalogue mounted while Next.js synchronizes usePathname with the URL.
    if (href !== `${window.location.pathname}${window.location.search}`) window.history.pushState(null, "", href);
  }}/>;
}
