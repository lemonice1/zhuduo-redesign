import test from "node:test";
import assert from "node:assert/strict";
import { authorizeInquiry, allowInquiry } from "../src/lib/inquiry-access.ts";

test("a CMS submission requires the server secret", () => {
  assert.equal(authorizeInquiry(undefined, "secret"), false);
  assert.equal(authorizeInquiry("Bearer wrong", "secret"), false);
  assert.equal(authorizeInquiry("Bearer secret", undefined), false);
  assert.equal(authorizeInquiry("Bearer secret", "secret"), true);
});

test("repeated submissions are limited and recover after the window", () => {
  const ip = "test-client";
  for (let i = 0; i < 5; i++) assert.equal(allowInquiry(ip, 1000), true);
  assert.equal(allowInquiry(ip, 1000), false);
  assert.equal(allowInquiry("other-client", 1000), true);
  assert.equal(allowInquiry(ip, 1000 + 60_001), true);
});
