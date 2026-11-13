const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateInquiry(input: Record<string, unknown> = {}) {
  input = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const value = {
    name: typeof input.name === "string" ? input.name.trim() : "",
    email: typeof input.email === "string" ? input.email.trim() : "",
    whatsapp: typeof input.whatsapp === "string" ? input.whatsapp.trim() : "",
    country: typeof input.country === "string" ? input.country.trim() : "",
    productType: typeof input.productType === "string" ? input.productType.trim() : "",
    quantity: typeof input.quantity === "string" ? input.quantity.trim() : "",
    message: typeof input.message === "string" ? input.message.trim() : "",
    source: typeof input.source === "string" ? input.source.trim() : "",
    website: typeof input.website === "string" ? input.website.trim() : ""
  };
  const errors: Record<string, string> = {};
  if (!value.name) errors.name = "Name is required.";
  if (value.name.length > 120) errors.name = "Name is too long.";
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
  if (!value.message) errors.message = "Message is required.";
  if (value.message.length > 4000) errors.message = "Message is too long.";
  for (const [field, limit] of Object.entries({ email: 254, country: 80, productType: 120, quantity: 40, source: 120 })) {
    if (value[field].length > limit) errors[field] = "This field is too long.";
  }
  if (value.website) errors.website = "Invalid submission.";
  return { value, errors, valid: Object.keys(errors).length === 0 };
}
