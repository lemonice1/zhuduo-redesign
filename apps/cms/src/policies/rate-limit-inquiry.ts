import { isIP } from "node:net";
import { errors } from "@strapi/utils";
import { authorizeInquiry, allowInquiry } from "../lib/inquiry-access";

export default (ctx: any) => {
  // Only the authenticated Next server may supply the visitor IP.
  if (!authorizeInquiry(ctx.request.get("authorization"), process.env.STRAPI_SERVER_TOKEN)) {
    throw new errors.UnauthorizedError("Inquiry submission requires the server credential.");
  }
  const forwarded = ctx.request.get("x-inquiry-client");
  const client = isIP(forwarded) ? forwarded : ctx.request.ip;
  ctx.state.inquiryClientIp = isIP(client) ? client : undefined;
  if (!allowInquiry(client || "unknown")) {
    throw new errors.RateLimitError("Too many requests. Please try again in a minute.");
  }
  return true;
};
