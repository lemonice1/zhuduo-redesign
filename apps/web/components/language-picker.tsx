"use client";

import { useEffect, useRef, useState } from "react";
import type { Language } from "./home-copy";
import { translate } from "../lib/site-language";

const languages = [
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
  { value: "fr", label: "Français" }
] as const;

export default function LanguagePicker({ language, onChange, openOnHover = false }: { language: Language; onChange: (language: Language) => void; openOnHover?: boolean }) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const focusMenu = useRef(true);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const label = translate(language, "Language");
  const cancelClose = () => clearTimeout(closeTimer.current);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (open && focusMenu.current) items.current[focused]?.focus();
  }, [open, focused]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) dismiss();
    };
    const escape = (event: KeyboardEvent) => {
      if (openOnHover && event.key === "Escape") {
        const restoreFocus = root.current?.contains(document.activeElement);
        dismiss();
        if (restoreFocus) trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, openOnHover]);

  function dismiss() {
    cancelClose();
    setOpen(false);
  }

  function openWithFocus(index: number) {
    cancelClose();
    focusMenu.current = true;
    setFocused(index);
    setOpen(true);
    if (open) items.current[index]?.focus();
  }

  function close() {
    dismiss();
    trigger.current?.focus();
  }

  return <div ref={root} className={`language-picker${openOnHover ? " language-picker-hover" : ""}`} onPointerEnter={event => {
    cancelClose();
    if (openOnHover && !open && event.pointerType === "mouse" && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      // Opening on hover must leave keyboard focus where it was.
      focusMenu.current = false;
      setFocused(languages.findIndex(option => option.value === language));
      setOpen(true);
    }
  }} onPointerLeave={event => {
    if (!openOnHover || event.pointerType !== "mouse") return;
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (!root.current?.contains(document.activeElement)) dismiss();
    }, 160);
  }} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) dismiss();
  }}>
    <button ref={trigger} id="language" className="language-trigger" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls="language-options" onClick={() => {
      if (open && focusMenu.current) dismiss();
      else openWithFocus(languages.findIndex(option => option.value === language));
    }} onKeyDown={event => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        openWithFocus(event.key === "ArrowDown" ? 0 : languages.length - 1);
      }
    }}>
      <svg className="language-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m7 4 1 4 4 1 1 3-3 1-1-2-5-1m16-3-4 1-1 3 3 2 3-1m-9 0-1 4 2 2v3" /></svg>
      <span>{language === "ar" ? "العربية" : language.toUpperCase()}</span>
      <svg className="language-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3.5 6 4.5 4 4.5-4" /></svg>
    </button>
    {open && <div id="language-options" className="language-menu" role="menu" aria-label={label} onKeyDown={event => {
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        setFocused(event.key === "Home" ? 0 : event.key === "End" ? languages.length - 1 : (focused + (event.key === "ArrowDown" ? 1 : -1) + languages.length) % languages.length);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else if (event.key === "Tab") {
        // Move from the trigger to the next/previous normal tab stop.
        trigger.current?.focus();
        dismiss();
      }
    }}>
      {languages.map((option, index) => <button key={option.value} ref={element => { items.current[index] = element; }} role="menuitemradio" aria-checked={language === option.value} tabIndex={-1} lang={option.value} onFocus={() => { focusMenu.current = true; setFocused(index); }} onClick={() => {
        close();
        if (option.value !== language) onChange(option.value);
      }}>
        <span dir={option.value === "ar" ? "rtl" : "ltr"}>{option.label}</span>
        {language === option.value && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>}
      </button>)}
    </div>}
  </div>;
}
