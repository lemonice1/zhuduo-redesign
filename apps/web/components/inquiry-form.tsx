"use client";

import { translate, type SiteLanguage } from "../lib/site-language";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import type { Product } from "../lib/content";
import ProductDirectionPicker from "./product-direction-picker";
import { loadTurnstileScript } from "../lib/turnstile";
import OkkiFormContext from "./okki-form-context";

type FormState = "idle" | "sending" | "success" | "error";
type FieldName = "name" | "email" | "country" | "productType" | "quantity" | "message" | "website" | "source";
const fieldLabels: Record<string, string> = {
  name: "Name",
  email: "Work email",
  country: "Country or region",
  productType: "Product direction",
  quantity: "Approx. quantity",
  message: "Project notes"
};

// General inquiry directions remain available before a language's products are published.
const generalDirections = [
  { value: "expandable-container-house", en: "Expandable container house" },
  { value: "space-capsule", en: "Space capsule" },
  { value: "custom-project", en: "Other / custom project" }
];

export default function InquiryForm({
  products,
  activeApplication,
  productType,
  setProductType,
  turnstileSiteKey = "",
  language = "en",
  preview = false,
  directions = [],
  source,
  compact = false,
  onConfirmed
}: {
  products: Product[];
  activeApplication: string;
  productType: string;
  setProductType: (value: string) => void;
  turnstileSiteKey?: string;
  language?: SiteLanguage;
  preview?: boolean;
  directions?: { value: string; title: string }[];
  source?: string;
  compact?: boolean;
  onConfirmed?: () => void;
}) {
  const tr = (english: string) => translate(language, english);
  const formId = useId();
  const [formState, setFormState] = useState<FormState>("idle");
  const [formMessage, setFormMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [proofToken, setProofToken] = useState("");
  const challengeRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!turnstileSiteKey || preview) return;
    let cancelled = false;
    void loadTurnstileScript().then(() => {
      if (cancelled || !window.turnstile || !challengeRef.current || widgetRef.current) return;
      widgetRef.current = window.turnstile.render(challengeRef.current, {
        sitekey: turnstileSiteKey,
        action: "inquiry",
        language,
        callback: (token: unknown) => { if (!cancelled && typeof token === "string") setProofToken(token); },
        "expired-callback": () => { if (!cancelled) setProofToken(""); },
        "error-callback": () => { if (!cancelled) { setProofToken(""); setFormMessage(tr("Please complete the inquiry verification again.")); } }
      });
    }).catch(() => {
      if (!cancelled) setFormMessage(tr("Inquiry verification is temporarily unavailable. Please try again."));
    });
    return () => {
      cancelled = true;
      if (widgetRef.current && window.turnstile?.remove) window.turnstile.remove(widgetRef.current);
      widgetRef.current = null;
      setProofToken("");
    };
  }, [turnstileSiteKey, language, preview]);

  function resetChallenge() {
    if (!turnstileSiteKey || !widgetRef.current || !window.turnstile?.reset) return;
    window.turnstile.reset(widgetRef.current);
    setProofToken("");
  }

  function focusFirstError(errors: Record<string, string>) {
    const first = Object.keys(fieldLabels).find((name) => errors[name]);
    if (first) formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"], [name="${first}"]:not([type="hidden"])`)?.focus();
  }

  async function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (preview) {
      formElement.reset();
      setProductType("");
      setFormState("success");
      setFormMessage(tr("Inquiry preview complete. No information was sent or stored."));
      onConfirmed?.();
      return;
    }
    setFormState("sending");
    setFormMessage("");
    setFieldErrors({});
    const payload = Object.fromEntries(new FormData(formElement).entries());
    if (turnstileSiteKey) payload.turnstileToken = proofToken;
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errors = body && typeof body.errors === "object" && body.errors ? body.errors as Record<string, string> : {};
        setFieldErrors(Object.fromEntries(Object.entries(errors).map(([field, message]) => [field, language === "en" ? message : tr("Please check this field.")])));
        setFormState("error");
        setFormMessage(tr(response.status === 429 ? "Too many requests. Please try again later." : "Please check the form and try again."));
        focusFirstError(errors);
        return;
      }
      if (typeof body?.id !== "string" || !body.id.trim() || body.status !== "received") {
        setFormState("error");
        setFormMessage(tr("The inquiry service did not confirm saving. Please contact us before resubmitting."));
        return;
      }
      setFormState("success");
      setFormMessage(tr("Thank you for your inquiry. We will contact you soon."));
      formElement.reset();
      setProductType("");
      setFieldErrors({});
      onConfirmed?.();
    } catch {
      setFormState("error");
      setFormMessage(tr("The inquiry service is temporarily unavailable."));
    } finally {
      resetChallenge();
      if (formState !== "success") setFormState((state) => state === "sending" ? "idle" : state);
    }
  }

  const inputProps = (name: FieldName) => ({
    name,
    dir: "auto" as const,
    "aria-invalid": fieldErrors[name] ? true : undefined,
    "aria-describedby": fieldErrors[name] ? `${formId}-${name}-error` : undefined
  });
  const selectedProduct = products.find(product => product.slug === productType)?.title
    || directions.find(direction => direction.value === productType)?.title
    || generalDirections.find(direction => direction.value === productType)?.en;

  return (
    <form ref={formRef} className="inquiry-form quote-form" onSubmit={submitInquiry} noValidate={false}>
      <OkkiFormContext ignored={preview} product={selectedProduct ? `${selectedProduct} (${productType})` : productType} source={source || `homepage:${activeApplication}`} language={language}/>
      <label>{tr("Name")}<input {...inputProps("name")} required maxLength={120} autoComplete="name" placeholder={tr("Your name")} />{fieldErrors.name && <span id={`${formId}-name-error`} className="field-error">{fieldErrors.name}</span>}</label>
      <label>{tr("Work email")}<input {...inputProps("email")} type="email" dir="ltr" autoComplete="email" required maxLength={254} placeholder="you@company.com" />{fieldErrors.email && <span id={`${formId}-email-error`} className="field-error">{fieldErrors.email}</span>}</label>
      <label>{tr("Country or region")}<input {...inputProps("country")} required maxLength={80} autoComplete="country-name" placeholder={tr("Where is the project?")} />{fieldErrors.country && <span id={`${formId}-country-error`} className="field-error">{fieldErrors.country}</span>}</label>
      <ProductDirectionPicker products={products} directions={products.length || directions.length ? directions : generalDirections.map(direction => ({ value: direction.value, title: tr(direction.en) }))} language={language} value={productType} onChange={setProductType} error={fieldErrors.productType}/>
      {!compact && <label>{tr("Approx. quantity")}<input {...inputProps("quantity")} maxLength={40} placeholder={tr("For example, 12 units")} />{fieldErrors.quantity && <span id={`${formId}-quantity-error`} className="field-error">{fieldErrors.quantity}</span>}</label>}
      <label className="full-row">{tr("Project notes")}<textarea {...inputProps("message")} required maxLength={4000} placeholder={tr("Use, timing, site context and the questions you already have.")} rows={5} />{fieldErrors.message && <span id={`${formId}-message-error`} className="field-error">{fieldErrors.message}</span>}</label>
      <input className="honeypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <input type="hidden" name="source" value={source || `homepage:${activeApplication}`} />
      {turnstileSiteKey && <div ref={challengeRef} className="turnstile-widget full-row" aria-live="polite" />}
      <button type="submit" className="btn primary full-row" disabled={formState === "sending" || Boolean(turnstileSiteKey && !proofToken)}>{formState === "sending" ? tr("Sending…") : preview ? tr("Preview inquiry flow ↗") : tr("Send project brief ↗")}</button>
      {formMessage && <p className={formState === "success" ? "form-status success full-row" : "form-status error full-row"} role="status" aria-live="polite">{formMessage}</p>}
    </form>
  );
}
