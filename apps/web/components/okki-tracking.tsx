"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const siteId = "528096-34388";

declare global {
  interface Window {
    okkiConfigs?: unknown[][];
  }
}

// The official SDK owns its listeners for the lifetime of this document.
// Loading it once also covers forms mounted later by client navigation.
export default function OkkiTracking({ preview }: { preview: boolean }) {
  const pathname = usePathname();
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || preview || /^\/preview(?:\/|$)/.test(pathname)) return;
    if (window.location.protocol !== "https:" || !["bjzdbuilding.com", "www.bjzdbuilding.com"].includes(window.location.hostname)) return;
    if (document.getElementById("okki-analytics")) return;

    window.okkiConfigs = window.okkiConfigs || [];
    window.okkiConfigs.push(["analytics", { siteId, gId: "" }]);
    const script = document.createElement("script");
    script.id = "okki-analytics";
    script.async = true;
    script.src = `https://tfile.xiaoman.cn/okki/analyze.js?id=${siteId}`;
    document.head.appendChild(script);
  }, [pathname, preview]);
  return null;
}
