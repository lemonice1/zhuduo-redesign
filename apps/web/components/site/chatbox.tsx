"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { normalizeInquiry } from "@modular/contracts";
import type { SiteLanguage } from "../../lib/site-language";
import { loadTurnstileScript } from "../../lib/turnstile";
import { chatboxCopy } from "./chatbox-copy";
import OkkiFormContext from "../okki-form-context";

function ChatIcon({ send = false }: { send?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {send ? <><path d="m21 3-7 18-4-7-7-4 18-7ZM10 14 21 3"/></> : <><path d="m3 21 1.5-5A9 9 0 1 1 8 20L3 21Z"/><path d="m8 7 2 3-1 1c1 2 2 3 4 4l1-1 3 1c-1 4-8 1-10-4-1-2 0-3 1-4Z"/></>}
  </svg>;
}

export default function Chatbox({ language, pathname, productType = "", preview = false, turnstileSiteKey = "" }: { language: SiteLanguage; pathname: string; productType?: string; preview?: boolean; turnstileSiteKey?: string }) {
  const t = chatboxCopy[language];
  const id = useId();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [proof, setProof] = useState("");
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const contactForm = useRef<HTMLFormElement>(null);
  const challenge = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const pending = useRef(false);
  const needsContact = messages.length > 0 && !saved;
  const messageLength = messages.join("\n\n").length;

  useEffect(() => {
    if (open) (composer.current || panel.current)?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (open && body.current) body.current.scrollTop = body.current.scrollHeight;
  }, [open, messages.length, saved]);

  useEffect(() => {
    if (!open || !needsContact || preview || !turnstileSiteKey) return;
    let cancelled = false;
    void loadTurnstileScript().then(() => {
      if (cancelled || !window.turnstile || !challenge.current) return;
      widget.current = window.turnstile.render(challenge.current, {
        sitekey: turnstileSiteKey, action: "inquiry", language, size: "compact",
        callback: (token: unknown) => { if (!cancelled && typeof token === "string") setProof(token); },
        "expired-callback": () => { if (!cancelled) setProof(""); },
        "error-callback": () => { if (!cancelled) { setProof(""); setError(t.verificationError); } }
      });
    }).catch(() => { if (!cancelled) setError(t.verificationError); });
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove?.(widget.current);
      widget.current = null;
      setProof("");
    };
  }, [open, needsContact, preview, turnstileSiteKey, language, t.verificationError]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => launcher.current?.focus({ preventScroll: true }));
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || pending.current) return;
    if ([...messages, message].join("\n\n").length > 4000) { setError(t.tooLong); return; }
    setMessages(previous => [...previous, message]);
    setDraft("");
    setError("");
  }

  async function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const conversation = [...messages, ...(draft.trim() ? [draft.trim()] : [])];
    const input = { ...Object.fromEntries(new FormData(event.currentTarget)), message: conversation.join("\n\n"), source: `chatbox:${language}:${pathname}`.slice(0, 120), productType: productType.slice(0, 120) };
    const validation = normalizeInquiry(input);
    setFieldErrors(validation.errors);
    setError("");
    if (!validation.valid) {
      setError(validation.errors.message ? t.tooLong : validation.errors.email || validation.errors.whatsapp ? t.contactError : t.checkField);
      const first = ["name", "country", "email", "whatsapp"].find(field => validation.errors[field]);
      if (first) contactForm.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
      return;
    }
    if (!preview && turnstileSiteKey && !proof) { setError(t.verification); return; }
    pending.current = true;
    setSending(true);
    try {
      if (!preview) {
        const response = await fetch("/api/inquiries", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...validation.value, ...(turnstileSiteKey ? { turnstileToken: proof } : {}) }),
          signal: AbortSignal.timeout(15_000)
        });
        const receipt = await response.json().catch(() => ({}));
        if (!response.ok) {
          setFieldErrors(receipt.errors && typeof receipt.errors === "object" ? receipt.errors : {});
          setError(response.status === 429 ? t.limited : t.unavailable);
          return;
        }
        if (receipt.status !== "received" || typeof receipt.id !== "string" || !receipt.id.trim()) { setError(t.unconfirmed); return; }
      }
      setMessages(conversation);
      setDraft("");
      setSaved(true);
      setFieldErrors({});
    } catch {
      setError(t.unavailable);
    } finally {
      if (widget.current) window.turnstile?.reset?.(widget.current);
      setProof("");
      pending.current = false;
      setSending(false);
    }
  }

  const fields = ([{ name: "name", label: t.name, autoComplete: "name", limit: 120 }, { name: "country", label: t.country, autoComplete: "country-name", limit: 80 }, { name: "email", label: t.email, autoComplete: "email", limit: 254 }, { name: "whatsapp", label: t.whatsapp, autoComplete: "tel", limit: 40 }] as const);

  return <div className="hp-chat">
    <button ref={launcher} className="hp-chat-launcher" type="button" hidden={open} aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => setOpen(true)}><ChatIcon/><span>{t.whatsapp}</span></button>
    <section ref={panel} className="hp-chat-panel" id={`${id}-panel`} role="dialog" aria-modal="false" aria-labelledby={`${id}-title`} hidden={!open} tabIndex={-1} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <header className="hp-chat-header"><span id={`${id}-title`}>{t.title}</span><button type="button" aria-label={t.close} onClick={close}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button></header>
      <div className="hp-chat-body" ref={body}>
        <div className="hp-chat-log" role="log" aria-label={t.messages} aria-live="polite" aria-relevant="additions">
          <p className="hp-chat-bubble hp-chat-assistant" dir="auto">{t.greeting}</p>
          {messages.map((message, index) => <p className="hp-chat-bubble hp-chat-visitor" dir="auto" key={index}>{message}</p>)}
          {needsContact && <p className="hp-chat-bubble hp-chat-assistant" dir="auto">{t.details}</p>}
          {saved && <p className="hp-chat-bubble hp-chat-assistant hp-chat-confirmation" dir="auto">{preview ? t.previewSuccess : t.success}</p>}
        </div>
        {needsContact && <form ref={contactForm} className="hp-chat-contact" onSubmit={submitContact}>
          <OkkiFormContext ignored/>
          <fieldset disabled={sending}><legend>{t.contactTitle}</legend><div className="hp-chat-fields">
            {fields.map(field => <label key={field.name} className={field.name === "email" || field.name === "whatsapp" ? "hp-chat-full" : undefined} htmlFor={`${id}-${field.name}`}>{field.label}{(field.name === "name" || field.name === "country") && " *"}
              <input id={`${id}-${field.name}`} name={field.name} type={field.name === "email" ? "email" : field.name === "whatsapp" ? "tel" : "text"} dir={field.name === "email" || field.name === "whatsapp" ? "ltr" : "auto"} autoComplete={field.autoComplete} required={field.name === "name" || field.name === "country"} maxLength={field.limit} placeholder={field.name === "email" ? t.emailPlaceholder : field.name === "whatsapp" ? "+44 7700 900123" : undefined} aria-invalid={Boolean(fieldErrors[field.name])} aria-describedby={fieldErrors[field.name] ? `${id}-${field.name}-error` : field.name === "email" || field.name === "whatsapp" ? `${id}-contact-hint` : undefined}/>
              {fieldErrors[field.name] && <span className="hp-chat-field-error" id={`${id}-${field.name}-error`}>{t.checkField}</span>}
            </label>)}
          </div><p className="hp-chat-hint" id={`${id}-contact-hint`}>{t.contactHint}</p>
          <input className="honeypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"/>
          {!preview && turnstileSiteKey && <div className="hp-chat-challenge" ref={challenge}/>}
          <button className="hp-chat-submit" type="submit" disabled={sending || Boolean(!preview && turnstileSiteKey && !proof)}>{sending ? t.sending : t.submit}</button></fieldset>
        </form>}
        {saved && <button className="hp-chat-again" type="button" onClick={() => { setMessages([]); setSaved(false); setError(""); requestAnimationFrame(() => composer.current?.focus({ preventScroll: true })); }}>{t.again}</button>}
      </div>
      {error && <p className="hp-chat-error" role="alert">{error}</p>}
      {preview && <p className="hp-chat-preview">{t.preview}</p>}
      {!saved && <form className="hp-chat-composer" onSubmit={sendMessage}>
        <OkkiFormContext ignored/>
        <textarea ref={composer} aria-label={t.messageLabel} placeholder={t.placeholder} dir="auto" rows={2} maxLength={4000} value={draft} disabled={sending || messageLength >= 4000} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}/>
        <button type="submit" aria-label={t.send} disabled={!draft.trim() || sending}><ChatIcon send/></button>
      </form>}
    </section>
  </div>;
}
