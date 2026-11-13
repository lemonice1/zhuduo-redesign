import { isIP } from "node:net";
import { errors } from "@strapi/utils";

export class InquiryVerificationConfigurationError extends Error {}

export async function verifyInquiryChallenge(token: unknown, ip?: string) {
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim();
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!siteKey && !secret) return;
  if (!siteKey || !secret) {
    throw new InquiryVerificationConfigurationError("Inquiry verification is unavailable.");
  }
  if (typeof token !== "string" || !token.trim() || token.length > 2048) {
    throw new errors.ValidationError("Please complete the inquiry verification.");
  }
  let result: any;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, ...(ip && isIP(ip) ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error("Verification upstream failed");
    result = await response.json();
  } catch {
    throw new Error("Inquiry verification is temporarily unavailable.");
  }
  const hostname = process.env.TURNSTILE_EXPECTED_HOSTNAME?.trim();
  if (result?.success !== true || result.action !== "inquiry" || (hostname && result.hostname !== hostname)) {
    throw new errors.ValidationError("Please complete the inquiry verification again.");
  }
}
