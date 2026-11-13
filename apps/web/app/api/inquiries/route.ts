import { inquiryFields, normalizeInquiry } from "@modular/contracts";
import { allowInquiry, inquiryClient } from "../../../lib/inquiry-access";

const unavailable = () => Response.json({ message: "The inquiry service is temporarily unavailable." }, { status: 502 });
const limited = () => Response.json({ message: "Too many requests. Please try again in a minute." }, { status: 429 });

function publicFieldErrors(body: unknown): Record<string, string> {
  // Strapi ValidationError details contain the validator's errors object.
  const details = (body as { error?: { details?: { errors?: unknown } } } | null)?.error?.details?.errors;
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};
  return Object.fromEntries(inquiryFields.filter(field => Object.hasOwn(details, field)).map(field => [field, "Please check this field."]));
}

export async function POST(request: Request) {
  const key = inquiryClient(request.headers);
  if (!allowInquiry(key)) return limited();
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ message: "Invalid request body." }, { status: 400 });
  }

  const validation = normalizeInquiry(payload);
  if (!validation.valid) {
    return Response.json({ errors: validation.errors }, { status: 400 });
  }

  const challengeEnabled = Boolean(process.env.TURNSTILE_SITE_KEY?.trim());
  const proof = (payload as { turnstileToken?: unknown } | null)?.turnstileToken;
  if (challengeEnabled && (typeof proof !== "string" || !proof.trim() || proof.length > 2048)) {
    return Response.json({ message: "Please complete the inquiry verification." }, { status: 400 });
  }

  const cmsUrl = process.env.STRAPI_PUBLIC_URL;
  const token = process.env.STRAPI_SERVER_TOKEN;

  if (!cmsUrl || !token) {
    return Response.json({ message: "Inquiry service is not configured." }, { status: 503 });
  }

  try {
    const upstream = await fetch(`${cmsUrl.replace(/\/$/, "")}/api/inquiries/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Inquiry-Client": key
      },
      body: JSON.stringify({ ...validation.value, ...(challengeEnabled ? { turnstileToken: proof } : {}) }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store"
    });

    const body = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      if (upstream.status === 429) return limited();
      if (upstream.status === 400) return Response.json({ message: "Please check the form and verification, then try again.", errors: publicFieldErrors(body) }, { status: 400 });
      return unavailable();
    }
    if (body?.status !== "received" || typeof body?.id !== "string" || !body.id.trim()) {
      return Response.json({ message: "The inquiry service did not confirm saving. Please contact us before resubmitting." }, { status: 502 });
    }
    return Response.json({ id: body.id, status: "received" }, { status: 201 });
  } catch {
    return unavailable();
  }
}
