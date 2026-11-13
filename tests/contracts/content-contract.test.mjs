import test from "node:test";
import assert from "node:assert/strict";
import { isPublicProduct, normalizeInquiry } from "../../packages/contracts/src/index.js";

test("accepts the public product contract", () => {
  assert.equal(
    isPublicProduct({
      slug: "folding-home",
      title: "Folding Home",
      summary: "A compact home that arrives ready for the next step.",
      category: "Folding",
      imageUrl: "/images/folding-home.jpg",
      customizableOptions: ["layout", "finish"]
    }),
    true
  );
});

test("rejects an invalid inquiry", () => {
  const result = normalizeInquiry({ name: "A", email: "bad", message: "" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.email);
  assert.ok(result.errors.message);
});

test("normalizes a valid inquiry", () => {
  const result = normalizeInquiry({
    name: "  Alex Chen ",
    email: " alex@example.com ",
    country: " Germany ",
    productType: "Folding home",
    message: "  Please send a layout range. "
  });
  assert.equal(result.valid, true);
  assert.equal(result.value.name, "Alex Chen");
  assert.equal(result.value.message, "Please send a layout range.");
});

test("rejects malformed JSON payloads without throwing", () => {
  for (const payload of [null, [], 42, "invalid"]) {
    assert.equal(normalizeInquiry(payload).valid, false);
  }
});

test("limits every inquiry field and strips untrusted internal fields", () => {
  const valid = { name: "Alex", email: "alex@example.com", country: "UK", message: "Six units" };
  for (const [field, limit] of Object.entries({ name: 120, email: 254, country: 80, productType: 120, quantity: 40, message: 4000, source: 120 })) {
    assert.equal(normalizeInquiry({ ...valid, [field]: "x".repeat(limit + 1) }).valid, false, field);
  }
  const normalized = normalizeInquiry({ ...valid, status: "won", internalNotes: "Hidden" });
  assert.equal(normalized.valid, true);
  assert.equal("status" in normalized.value, false);
  assert.equal("internalNotes" in normalized.value, false);
});

test("chatbox accepts either contact method and normalizes international WhatsApp numbers", () => {
  const chat = { name: "Alex", country: "UK", message: "Six modules", source: "chatbox:en:/products/electrical" };
  for (const contact of [{ email: "alex@example.com" }, { whatsapp: " +44 (7700) 900-123 " }, { email: "alex@example.com", whatsapp: "+447700900123" }]) {
    const result = normalizeInquiry({ ...chat, ...contact });
    assert.equal(result.valid, true);
    if (contact.whatsapp) assert.equal(result.value.whatsapp, "+447700900123");
  }
  for (const contact of [{}, { email: "bad" }, { whatsapp: "123456789" }, { whatsapp: "+00000000" }, { whatsapp: "+44 hello 7700900123" }, { whatsapp: "+1234567890123456" }, { email: "bad", whatsapp: "+447700900123" }]) {
    assert.equal(normalizeInquiry({ ...chat, ...contact }).valid, false, JSON.stringify(contact));
  }
  assert.ok(normalizeInquiry({ ...chat, whatsapp: "+447700900123", source: "site:/" }).errors.email, "regular inquiries still require email");
});
