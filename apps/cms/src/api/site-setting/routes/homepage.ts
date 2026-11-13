export default {
  routes: [{ method: "GET", path: "/homepage", handler: "api::site-setting.site-setting.homepage", config: { auth: false } }]
};
