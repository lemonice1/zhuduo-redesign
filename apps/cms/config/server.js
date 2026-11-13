module.exports = ({ env }) => ({
  host: env("HOST", "0.0.0.0"),
  port: env.int("PORT", 1337),
  url: env("PUBLIC_URL", "http://localhost:1337"),
  proxy: { koa: env.bool("IS_PROXIED", true), maxIpsCount: env.int("MAX_IPS_COUNT", 1) },
  transfer: { remote: { enabled: env.bool("STRAPI_REMOTE_TRANSFER_ENABLED", false) } },
  app: { keys: env.array("APP_KEYS", ["dev-key-one", "dev-key-two"]) },
  admin: { serveAdminPanel: true }
});
