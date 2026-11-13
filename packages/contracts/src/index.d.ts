export type InquiryPayload = {
  name: string;
  email: string;
  whatsapp?: string;
  country: string;
  productType?: string;
  quantity?: string;
  message: string;
  source?: string;
  website?: string;
};

export type InquiryValidation = {
  value: InquiryPayload & Record<string, string>;
  errors: Record<string, string>;
  valid: boolean;
};

export function normalizeInquiry(input?: unknown): InquiryValidation;
export function isPublicProduct(value: unknown): boolean;
export const inquiryFields: string[];
