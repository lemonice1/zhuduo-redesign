import { factories } from "@strapi/strapi";
import { errors } from "@strapi/utils";
import { InquiryVerificationConfigurationError } from "../../../lib/inquiry-challenge";

export default factories.createCoreController("api::inquiry.inquiry", ({ strapi }) => ({
  async health(ctx: any) {
    try {
      await strapi.db.connection.raw("select 1");
      return { ok: true };
    } catch {
      return ctx.internalServerError("Database is unavailable.");
    }
  },

  async create(ctx: any) {
    try {
      return await strapi.service("api::inquiry.inquiry").submit(
        ctx.request.body?.data ?? ctx.request.body ?? {}, ctx.state.inquiryClientIp
      );
    } catch (error) {
      if (error instanceof errors.ValidationError) throw error;
      const status = error instanceof InquiryVerificationConfigurationError ? 503 : 502;
      ctx.status = status;
      ctx.body = { error: { message: status === 503 ? "Inquiry verification is unavailable." : "Unable to save the inquiry. Please try again later." } };
    }
  }
}));
