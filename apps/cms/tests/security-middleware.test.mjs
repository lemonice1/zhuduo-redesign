import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createRequire } from "node:module";
import path from "node:path";
import Koa from "koa";
import createMiddlewares from "../config/middlewares.js";

const require = createRequire(import.meta.url);
const { security } = require(path.join(
  path.dirname(require.resolve("@strapi/core")),
  "middlewares/security.js"
));

test("CMS security allows HTTP health requests while retaining the media CSP", async (t) => {
  const middlewares = createMiddlewares({
    env: (name, fallback) => name === "MEDIA_PUBLIC_URL"
      ? "http://192.168.200.100:9000/modular-housing-dev"
      : fallback
  });
  const { config } = middlewares.find((middleware) => middleware.name === "strapi::security");
  const app = new Koa();
  let middlewareError;
  app.on("error", (error) => { middlewareError = error; });
  app.use(security(config, {
    strapi: {
      plugin: () => undefined,
      config: { get: () => "/admin" }
    }
  }));
  app.use((ctx) => { ctx.body = { ok: true }; });

  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  }));
  await once(server, "listening");
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);

  assert.equal(response.status, 200, middlewareError?.message);
  assert.deepEqual(await response.json(), { ok: true });
  const policy = response.headers.get("content-security-policy");
  assert.ok(policy, "CMS must still send a Content-Security-Policy header");
  const directives = new Map(policy.split(";").map((directive) => {
    const [name, ...sources] = directive.trim().split(/\s+/);
    return [name, sources];
  }));
  assert.deepEqual(directives.get("default-src"), ["'self'"]);
  assert.ok(directives.get("img-src").includes("http://192.168.200.100:9000"));
  assert.ok(directives.get("media-src").includes("http://192.168.200.100:9000"));
  assert.equal(directives.has("upgrade-insecure-requests"), false);
});
