"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export default function NavDropdown({ id, label, open, onOpenChange, children }: {
  id: string;
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [focusEdge, setFocusEdge] = useState<"first" | "last" | null>(null);

  const clearCloseTimer = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const panelItems = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') || []);

  useEffect(() => () => clearCloseTimer(), []);

  useEffect(() => {
    if (!open || !focusEdge) return;
    const items = panelItems();
    (focusEdge === "first" ? items[0] : items.at(-1))?.focus();
    setFocusEdge(null);
  }, [open, focusEdge]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      clearCloseTimer();
      onOpenChange(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, onOpenChange]);

  return <div ref={root} className="nav-dropdown" onPointerEnter={event => {
    clearCloseTimer();
    if (event.pointerType === "mouse" && window.matchMedia("(min-width: 851px) and (hover: hover) and (pointer: fine)").matches) onOpenChange(true);
  }} onPointerLeave={event => {
    if (event.pointerType !== "mouse") return;
    clearCloseTimer();
    closeTimer.current = setTimeout(() => {
      // Keep a keyboard user's focused links available when the pointer moves away.
      if (!root.current?.contains(document.activeElement)) onOpenChange(false);
    }, 120);
  }} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      clearCloseTimer();
      onOpenChange(false);
    }
  }}>
    <button ref={trigger} id={id} type="button" className="nav-dropdown-trigger" aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => {
      clearCloseTimer();
      onOpenChange(!open);
    }} onKeyDown={event => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      clearCloseTimer();
      setFocusEdge(event.key === "ArrowDown" ? "first" : "last");
      onOpenChange(true);
    }}>{label}</button>
    <div ref={panel} id={`${id}-panel`} className="nav-dropdown-panel" hidden={!open} onKeyDown={event => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const items = panelItems();
      if (!items.length) return;
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }} onClick={event => {
      if ((event.target as HTMLElement).closest("a, button")) {
        clearCloseTimer();
        onOpenChange(false);
      }
    }}>{children}</div>
  </div>;
}
