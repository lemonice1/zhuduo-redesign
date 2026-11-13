import test from "node:test";
import assert from "node:assert/strict";
import { validateInquiry } from "../src/api/inquiry/validators/inquiry.ts";
import { normalizeInquiry } from "../../../packages/contracts/src/index.js";

test("CMS inquiry validator accepts a normalized payload", () => {
  const result = validateInquiry({
    name: "  Jamie Wu ",
    email: " jamie@example.com ",
    country: " Netherlands ",
    message: "  We need six accommodation modules. "
  });
  assert.equal(result.valid, true);
  assert.equal(result.value.name, "Jamie Wu");
  assert.equal(result.value.message, "We need six accommodation modules.");
});

test("CMS inquiry validator rejects the honeypot and invalid email", () => {
  const result = validateInquiry({ email: "wrong", website: "bot" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.email);
  assert.ok(result.errors.website);
});

test("CMS validation rejects oversized fields", () => {
  const result = validateInquiry({
    name: "Alex", email: "alex@example.com", country: "x".repeat(81), message: "Six modules"
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.country);
});

test("CMS and proxy agree on chat contacts, malformed contacts and standard email requirements", () => {
  const base = { name: "Alex", country: "UK", message: "Six modules", source: "chatbox:en:/" };
  for (const contact of [{}, { email: "alex@example.com" }, { whatsapp: "+44 (7700) 900-123" }, { email: "bad", whatsapp: "+447700900123" }, { whatsapp: "+123" }, { whatsapp: "+447700900123", source: "site:/" }, { whatsapp: "abc+447700900123" }, { whatsapp: "+447700900123", website: "spam" }]) {
    const input = { ...base, ...contact };
    const shared = normalizeInquiry(input), cms = validateInquiry(input);
    assert.equal(cms.valid, shared.valid);
    assert.deepEqual(Object.keys(cms.errors).sort(), Object.keys(shared.errors).sort());
    assert.deepEqual(cms.value, shared.value);
  }
});
