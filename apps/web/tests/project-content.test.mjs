import test from "node:test";
import assert from "node:assert/strict";
import { load, withEnvironment } from "./compiled-web.mjs";

const data = { slug: "published-project", title: "Published project", locale: "en", publishedAt: "2026-11-03T00:00:00.000Z", isVerified: true };
test("project content requires the exact published, verified locale without sample fallbacks", () => {
  const { normalizeProjectDetail } = load("lib/project-content.js");
  for (const patch of [{ locale: "fr" }, { isVerified: false }, { publishedAt: null }, { slug: "another" }]) assert.equal(normalizeProjectDetail({ ...data, ...patch }, data.slug, "en", "http://cms.local"), null);
  const minimal = normalizeProjectDetail(data, data.slug, "en", "http://cms.local");
  assert.deepEqual(minimal.gallery, []);
  assert.deepEqual(minimal.projectFaqs, []);
  assert.equal(minimal.detail, "");
  assert.equal(minimal.videoUrl, "");
  assert.equal(minimal.sample, undefined);
  const complete = normalizeProjectDetail({ ...data, image: { url: "/uploads/main.jpg" }, gallery: [{ url: "/uploads/main.jpg" }, { url: "javascript:alert(1)" }, { url: "/uploads/second.jpg", caption: "Stage" }], projectFacts: [{ label: " Area ", value: " 100 m² ", internal: "private" }, { label: "Incomplete", value: "" }], features: [" Feature ", null], projectFaqs: [{ question: " Q ", answer: " A ", internal: "private" }], video: { url: "https://u:p@cms.local/video.mp4" } }, data.slug, "en", "http://cms.local");
  assert.equal(complete.gallery.length, 2);
  assert.equal(complete.gallery[0].url, "http://cms.local/uploads/main.jpg");
  assert.deepEqual(complete.projectFacts, [{ label: "Area", value: "100 m²" }]);
  assert.deepEqual(complete.projectFaqs, [{ question: "Q", answer: "A" }]);
  assert.deepEqual(complete.features, ["Feature"]);
  assert.equal(complete.videoUrl, "");
  const steps = normalizeProjectDetail({ ...data, productionImages: [{ url: "/uploads/one.jpg", caption: "Shared caption" }, { url: "/uploads/two.jpg", caption: "Second shared caption" }], productionSteps: ["Localized step", ""] }, data.slug, "en", "http://cms.local");
  assert.deepEqual(steps.productionImages.map(image => image.caption), ["Localized step", "Second shared caption"]);
});

test("project loader uses its own slug endpoint and 30 second cache and distinguishes 404 from failures", async () => {
  await withEnvironment({ STRAPI_PUBLIC_URL: "https://cms.local", SITE_PREVIEW_MODE: undefined }, async () => {
    const { loadProjectDetail } = load("lib/project-content.js");
    const nativeFetch = global.fetch; const calls = [];
    try {
      global.fetch = async (url, options) => { calls.push({ url, options }); return Response.json({ data }); };
      assert.equal((await loadProjectDetail(data.slug, "en")).title, data.title);
      assert.equal(calls[0].url, "https://cms.local/api/project-cases/slug/published-project?locale=en");
      assert.equal(calls[0].options.next.revalidate, 30);
      assert.equal(await loadProjectDetail("../private", "en"), null);
      assert.equal(calls.length, 1);
      global.fetch = async () => new Response(null, { status: 404 });
      assert.equal(await loadProjectDetail(data.slug, "fr"), null);
      global.fetch = async () => new Response(null, { status: 503 });
      await assert.rejects(loadProjectDetail(data.slug, "en"), /unavailable/);
    } finally { global.fetch = nativeFetch; }
  });
});

test("only the preview explicitly supplies a full localized sample", () => {
  const { sampleProject } = load("lib/project-sample.js");
  for (const language of ["en", "fr", "ar"]) {
    const sample = sampleProject(language);
    assert.equal(sample.sample, true);
    for (const field of ["gallery", "features", "detailImages", "certificateImages", "productionImages", "referenceImages", "shippingImages", "projectFaqs"]) assert.ok(sample[field].length, field);
    assert.match(sample.videoUrl, /^\/videos\//);
    assert.ok(sample.certificateImages.every(image => image.url === "/projects/placeholder-certificate.svg"));
  }
});

test("project inquiry attribution preserves long slugs through stable document identity", () => {
  const { projectInquirySource } = load("lib/project-detail.js");
  assert.equal(projectInquirySource({ slug: "normal" }), "project:/projects/featured-projects/normal");
  assert.equal(projectInquirySource({ slug: "a".repeat(128), documentId: "stable-document-id" }), "project:stable-document-id");
});
