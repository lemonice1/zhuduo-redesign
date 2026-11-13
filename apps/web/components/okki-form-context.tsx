// OKKI's automatic form binding skips type=hidden and zero-height controls.
// Keep this metadata outside the visual/focus flow, with a measurable control.
// Stable names (without React-generated IDs) also keep CRM field mapping stable.
export default function OkkiFormContext({ ignored = false, product = "", source = "", language = "" }: {
  ignored?: boolean;
  product?: string;
  source?: string;
  language?: string;
}) {
  const fields = ignored
    ? [{ name: "target-sdk-ignore", label: "Exclude automatic form binding", value: "true" }]
    : [
      { name: "product", label: "Product", value: product },
      { name: "inquirySource", label: "Inquiry source", value: source },
      { name: "inquiryLanguage", label: "Website language", value: language }
    ];
  return <div className="okki-form-context" aria-hidden="true">
    {fields.map(field => <label key={field.name}>{field.label}<input name={field.name} value={field.value} readOnly tabIndex={-1} autoComplete="off"/></label>)}
  </div>;
}
