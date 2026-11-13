const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const inquiryFields = [
  "name",
  "email",
  "whatsapp",
  "country",
  "productType",
  "quantity",
  "message",
  "source",
  "website"
];

export function normalizeInquiry(input = {}) {
  const payload = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const value = Object.fromEntries(
    inquiryFields.map((field) => [field, typeof payload[field] === "string" ? payload[field].trim() : ""])
  );

  const errors = {};
  if (!value.name) errors.name = "Name is required.";
  const chatbox = value.source.startsWith("chatbox:");
  if ((!chatbox || value.email) && !emailPattern.test(value.email)) errors.email = "Enter a valid email.";
  if (value.whatsapp) {
    const compact = value.whatsapp.replace(/[\s().-]/g, "");
    if (!/^[+\d\s().-]+$/.test(value.whatsapp) || !/^\+[1-9]\d{6,14}$/.test(compact) || value.whatsapp.length > 40) errors.whatsapp = "Enter an international WhatsApp number.";
    else value.whatsapp = compact;
  }
  if (chatbox && !value.email && !value.whatsapp) {
    errors.email = "Enter an email or WhatsApp number.";
    errors.whatsapp = "Enter an email or WhatsApp number.";
  }
  if (!value.country) errors.country = "Country is required.";
  if (!value.message) errors.message = "Tell us what you are planning.";
  if (value.name.length > 120) errors.name = "Name is too long.";
  if (value.message.length > 4000) errors.message = "Message is too long.";
  for (const [field, limit] of Object.entries({ email: 254, country: 80, productType: 120, quantity: 40, source: 120 })) {
    if (value[field].length > limit) errors[field] = "This field is too long.";
  }
  if (value.website) errors.website = "Invalid submission.";

  return { value, errors, valid: Object.keys(errors).length === 0 };
}

export function isPublicProduct(value) {
  return Boolean(
    value &&
      typeof value.slug === "string" &&
      typeof value.title === "string" &&
      typeof value.summary === "string" &&
      typeof value.category === "string" &&
      typeof value.imageUrl === "string" &&
      Array.isArray(value.customizableOptions)
  );
}
