"use client";

import { useEffect, type RefObject } from "react";

declare global { interface Window { initZhuduoWhiteboard?: (root: HTMLElement) => () => void } }
const scripts = new Map<string, Promise<void>>();
function script(name: string) {
  const src = `/whiteboard-original/${name}`;
  if (!scripts.has(src)) scripts.set(src, new Promise((resolve, reject) => {
    const node = document.createElement("script");
    node.src = src; node.async = true;
    node.onload = () => resolve(); node.onerror = () => reject(new Error(`Cannot load preview visual library: ${name}`));
    document.head.appendChild(node);
  }));
  return scripts.get(src)!;
}

export default function VisualRuntime({ root }: { root: RefObject<HTMLDivElement | null> }) {
  useEffect(() => {
    let disposed = false;
    let destroy: (() => void) | undefined;
    void (async () => {
      await script("js/gsap.min.js");
      await Promise.all(["ScrollTrigger.min.js", "Flip.min.js", "SplitText.min.js", "lenis.min.js"].map(name => script(`js/${name}`)));
      await script("reference-runtime.js");
      await document.fonts.ready;
      if (!disposed && root.current) destroy = window.initZhuduoWhiteboard?.(root.current);
    })().catch(error => console.error(error));
    return () => { disposed = true; destroy?.(); };
  }, [root]);
  return null;
}
