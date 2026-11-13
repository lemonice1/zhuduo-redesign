import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { businessProjectLayout, projectRowShape } from "../src/admin/project-editor-data.mjs";

test("project business panels preserve fields, permissions, old content and native media controls", () => {
  const schema = JSON.parse(readFileSync(new URL("../src/api/project-case/content-types/project-case/schema.json", import.meta.url)));
  const fields = Object.entries(schema.attributes).map(([name, attribute]) => ({ name, attribute, type: attribute.type, disabled: name === "projectFacts", visible: name !== "imageUrl" }));
  const input = { query: { plugins: { i18n: { locale: "ar" } } }, layout: { settings: { displayName: "Project Case" }, layout: [[fields]] } };
  const original = structuredClone(input);
  const result = businessProjectLayout(input);
  assert.deepEqual(input, original);
  assert.equal(result.layout.layout.length, 7);
  const output = result.layout.layout.flat(2);
  assert.deepEqual(output.map(field => field.name).sort(), fields.map(field => field.name).sort());
  assert.equal(output.find(field => field.name === "projectFacts").disabled, true);
  assert.equal(output.find(field => field.name === "imageUrl").visible, false);
  for (const name of ["projectFacts", "features", "projectFaqs", "productionSteps"]) {
    assert.equal(output.find(field => field.name === name).type, "project-rows");
    assert.equal(schema.attributes[name].type, "json");
    assert.equal(schema.attributes[name].pluginOptions.i18n.localized, true);
    assert.notEqual(schema.attributes[name].required, true);
  }
  for (const name of ["introImage", "detailImages", "certificateImages", "video", "productionImages", "referenceImages", "shippingImages"]) {
    assert.equal(output.find(field => field.name === name).type, "media");
    assert.notEqual(schema.attributes[name].required, true);
  }
  assert.deepEqual(schema.attributes.video.allowedTypes, ["videos"]);
  const restricted = { layout: { settings: input.layout.settings, layout: [[[fields.find(field => field.name === "projectFaqs")]]] } };
  assert.deepEqual(businessProjectLayout(restricted).layout.layout.flat(2).map(field => field.name), ["projectFaqs"]);
  const other = { ...input, layout: { ...input.layout, settings: { displayName: "Product" } } };
  assert.equal(businessProjectLayout(other), other);
  assert.deepEqual(projectRowShape("projectFacts"), ["label", "value"]);
  assert.deepEqual(projectRowShape("projectFaqs"), ["question", "answer"]);
});
