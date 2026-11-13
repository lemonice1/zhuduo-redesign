// Each application owns a localized, publishable Single Type.
export const applicationTypes = [
  "application-energy-utilities",
  "application-industrial-projects",
  "application-residential-hospitality",
  "application-commercial-temporary-buildings",
] as const;
export const applicationFields = ["title", "summary", "body"];
export const applicationMedia = ["coverImage"];
