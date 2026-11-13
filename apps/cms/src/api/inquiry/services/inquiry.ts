import { errors } from "@strapi/utils";
import { validateInquiry } from "../validators/inquiry";
import { verifyInquiryChallenge } from "../../../lib/inquiry-challenge";

export default ({ strapi }) => ({
  async submit(input: Record<string, unknown>, ip?: string) {
    const validation = validateInquiry(input);
    if (!validation.valid) {
      throw new errors.ValidationError("Please correct the inquiry fields.", { errors: validation.errors });
    }
    await verifyInquiryChallenge(input?.turnstileToken, ip);
    const { website, ...data } = validation.value;
    const entity = await strapi.documents("api::inquiry.inquiry").create({ data: { ...data, email: data.email || null, followUpStatus: "new" } });
    const id = entity?.documentId ?? entity?.id;
    if ((typeof id !== "string" && typeof id !== "number") || String(id).trim() === "") {
      throw new Error("Inquiry persistence did not return an identifier.");
    }
    return { id: String(id), status: "received" };
  },
  async health() {
    await strapi.db.connection.raw("select 1");
    return { ok: true };
  }
});
