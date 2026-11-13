import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readProductDetail, writeProductDetail, businessProductLayout, businessCategoryLayout } from "../src/admin/product-editor-data.mjs";

test("opening or leaving an imported detail unchanged preserves the exact source, including CRLF and Markdown", () => {
  const source = "## Product overview\r\n\r\nA complete house.\r\nWidth： 6,300 mm\r\n\r\nVoltage: 10 kV\r\n";
  const draft = readProductDetail(source);
  assert.equal(writeProductDetail(source, draft), source);
  assert.deepEqual(draft.specifications, [{ label: "Width", value: "6,300 mm" }, { label: "Voltage", value: "10 kV" }]);
  assert.match(draft.description, /## Product overview/);
  const updated = { ...draft, specifications: [...draft.specifications, { label: "Power", value: "250 kVA" }] };
  assert.deepEqual(readProductDetail(writeProductDetail(source, updated)), updated);
});

test("category edit layout keeps native permissions, publishing fields and Chinese business labels", () => {
  const schema = JSON.parse(readFileSync(new URL("../src/api/product-category/content-types/product-category/schema.json", import.meta.url)));
  const fields = Object.entries(schema.attributes).filter(([, attr]) => attr.visible !== false).map(([name, attribute]) => ({ name, attribute, type: attribute.type, disabled: name === 'slug' }));
  const input = { layout: { layout: [[fields]], settings: { mainField: 'nameEn' } } };
  const original = structuredClone(input);
  const output = businessCategoryLayout(input).layout.layout.flat(2);
  assert.deepEqual(input, original);
  assert.deepEqual(output.map(field => field.name).sort(), fields.map(field => field.name).sort());
  assert.equal(output.find(field => field.name === 'division').type, 'category-location');
  assert.equal(output.find(field => field.name === 'slug').disabled, true);
  assert.equal(output.find(field => field.name === 'visible').label, '在菜单中显示');
  assert.equal(schema.options.draftAndPublish, true);
  assert.notEqual(schema.pluginOptions?.i18n?.localized, true);
  assert.equal(businessProductLayout(input), input);
});

test("editing/reordering/deleting rows retains prose, units, embedded colons and incomplete drafts", () => {
  const source = "Site requirements\nOverall dimensions: 5,900 × 6,300 × 2,480 mm\nRatio: 10:0.4 kV\nFinishes available.";
  const draft = readProductDetail(source);
  draft.specifications.reverse();
  draft.specifications[1].value = "6,000 × 6,300 × 2,480 mm";
  draft.specifications.push({ label: "", value: "" });
  const edited = writeProductDetail(source, draft);
  assert.deepEqual(readProductDetail(edited), draft);
  assert.equal(readProductDetail(writeProductDetail(edited, { ...draft, specifications: [] })).description, draft.description);
});

test("the layout only adapts products, keeps all original fields and honors visibility/read-only flags", () => {
  const schema = JSON.parse(readFileSync(new URL("../src/api/product/content-types/product/schema.json", import.meta.url)));
  const fields = Object.entries(schema.attributes).filter(([, attribute]) => attribute.visible !== false).map(([name, attribute]) => ({ name, attribute, type: attribute.type, size: 6, visible: name !== "sourceReference", disabled: name === "detail" }));
  const input = { query: { plugins: { i18n: { locale: "ar" } } }, layout: { layout: [fields.map(field => [field])], settings: {}, metadatas: {} } };
  const original = structuredClone(input);
  const result = businessProductLayout(input);
  const output = result.layout.layout.flat(2);
  assert.deepEqual(input, original, "the cached Strapi layout must not be mutated");
  assert.deepEqual(output.map(field => field.name).sort(), fields.map(field => field.name).sort());
  assert.equal(output.find(field => field.name === "detail").disabled, true);
  assert.equal(output.find(field => field.name === "sourceReference").visible, false);
  assert.equal(output.find(field => field.name === "customizableOptions").attribute.type, "json");
  assert.equal(output.find(field => field.name === "customizableOptions").type, "product-options");
  assert.equal(schema.attributes.productFaqs.pluginOptions.i18n.localized, true);
  const other = { layout: { layout: [[[fields.find(field => field.name === "title")]]] } };
  assert.equal(businessProductLayout(other), other);
});
