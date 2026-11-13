export default {
  routes: [
    {
      method: "POST",
      path: "/inquiries/submit",
      handler: "api::inquiry.inquiry.create",
      config: {
        auth: false,
        policies: ["global::rate-limit-inquiry"]
      }
    }
  ]
};
