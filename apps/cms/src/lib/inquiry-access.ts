import { createHash, timingSafeEqual } from "node:crypto";

export function authorizeInquiry(header: string | undefined, secret: string | undefined): boolean {
  if (!header?.startsWith("Bearer ") || !secret) return false;
  const supplied = createHash("sha256").update(header.slice(7)).digest();
  const expected = createHash("sha256").update(secret).digest();
  return timingSafeEqual(supplied, expected);
}

const recentRequests = new Map<string, { start: number; count: number }>();

export function allowInquiry(key: string, now = Date.now()): boolean {
  for (const [ip, entry] of recentRequests) {
    if (now - entry.start >= 60_000) recentRequests.delete(ip);
  }
  const current = recentRequests.get(key) ?? { start: now, count: 0 };
  current.count++;
  recentRequests.set(key, current);
  return current.count <= 5;
}
