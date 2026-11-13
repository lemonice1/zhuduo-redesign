export default {
  routes: [
    {
      method: "GET",
      path: "/health",
      handler: "api::inquiry.inquiry.health",
      config: { auth: false }
    }
  ]
};
