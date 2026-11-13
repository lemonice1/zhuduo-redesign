"use client";

import { useEffect, useRef, useState } from "react";

export default function CountUpNumber({ value, grouping = false }: { value: number; grouping?: boolean }) {
  const element = useRef<HTMLSpanElement>(null);
  const [current, setCurrent] = useState<number | null>(null);
  const format = (number: number) => grouping ? number.toLocaleString("en-US") : String(number);

  useEffect(() => {
    const node = element.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!node || !window.IntersectionObserver || motion.matches || !Number.isFinite(value) || value <= 1) {
      setCurrent(null);
      return;
    }

    let frame = 0;
    let start: number | null = null;
    let disposed = false;
    setCurrent(1);

    function tick(time: number) {
      if (disposed) return;
      start ??= time;
      const progress = Math.min((time - start) / 1800, 1);
      if (progress === 1) {
        setCurrent(null);
        return;
      }
      const eased = 1 - (1 - progress) ** 3;
      setCurrent(Math.floor(1 + (value - 1) * eased));
      frame = requestAnimationFrame(tick);
    }

    const observer = new IntersectionObserver(entries => {
      if (!disposed && !motion.matches && entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .5)) {
        observer.disconnect();
        frame = requestAnimationFrame(tick);
      }
    }, { threshold: .5 });
    observer.observe(node);

    function motionChanged() {
      if (!motion.matches) return;
      observer.disconnect();
      cancelAnimationFrame(frame);
      setCurrent(null);
    }
    motion.addEventListener("change", motionChanged);
    return () => {
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", motionChanged);
    };
  }, [value]);

  // Keep the final value accessible and reserve its width throughout the animation.
  return <span className="hp-count-up" ref={element} data-counting={current !== null ? true : undefined}>
    <span className="hp-count-up-final">{format(value)}</span>
    {current !== null && <span className="hp-count-up-current" aria-hidden="true">{format(current)}</span>}
  </span>;
}
