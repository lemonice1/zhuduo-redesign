module.exports = ({ env }) => {
  const mediaOrigin = new URL(env("MEDIA_PUBLIC_URL", "http://localhost:9000/modular-housing-dev")).origin;
  return [
    "strapi::logger",
    "strapi::errors",
    {
      name: "strapi::security",
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            "img-src": ["'self'", "data:", "blob:", mediaOrigin],
            "media-src": ["'self'", "data:", "blob:", mediaOrigin],
            upgradeInsecureRequests: null
          }
        }
      }
    },
    "strapi::cors",
    "strapi::poweredBy",
    "strapi::query",
    { name: "strapi::body", config: { jsonLimit: "1mb", formLimit: "1mb" } },
    "strapi::session",
    "strapi::favicon",
    "strapi::public"
  ];
};
