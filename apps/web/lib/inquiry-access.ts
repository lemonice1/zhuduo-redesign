import { isIP } from "node:net";

const recentRequests = new Map<string, { start: number; count: number }>();

export function inquiryClient(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.trim();
  return process.env.TRUST_PROXY === "true" && forwarded && isIP(forwarded) ? forwarded : "untrusted-client";
}

export function allowInquiry(key: string, now = Date.now()): boolean {
  for (const [ip, entry] of recentRequests) {
    if (now - entry.start >= 60_000) recentRequests.delete(ip);
  }
  const current = recentRequests.get(key) ?? { start: now, count: 0 };
  current.count++;
  recentRequests.set(key, current);
  return current.count <= 5;
}
