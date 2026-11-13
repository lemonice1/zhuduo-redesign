// Exercise the built Next.js app against a local HTTP CMS test double.
// Real PostgreSQL/MinIO persistence is verified separately on the Ubuntu VM.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";

const demo = JSON.parse(fs.readFileSync("packages/contracts/demo-content.json", "utf8"));
const records = [];
const cms = http.createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.url === "/api/homepage?locale=en") {
    response.end(JSON.stringify(demo));
  } else if (request.url.startsWith("/api/products?")) {
    response.end(JSON.stringify({ data: demo.products.map(product => ({ ...product, categoryKey: 'expandable-homes', customizableOptions: product.options })), meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: demo.products.length } } }));
  } else if (request.url === "/api/inquiries/submit") {
    if (request.headers.authorization !== "Bearer smoke-token") {
      response.writeHead(401).end(JSON.stringify({ error: { message: "Unauthorized" } }));
      return;
    }
    let input = "";
    for await (const chunk of request) input += chunk;
    const data = JSON.parse(input);
    if (data.name === "Upstream failure") {
      response.writeHead(500).end(JSON.stringify({ error: { message: "Unavailable" } }));
      return;
    }
    if (data.name === "Missing acknowledgement") {
      response.end("{}");
      return;
    }
    records.push(data);
    response.writeHead(201).end(JSON.stringify({ id: "smoke-1", status: "received" }));
  } else response.writeHead(404).end("{}");
});
await new Promise(resolve => cms.listen(0, "127.0.0.1", resolve));
const cmsPort = cms.address().port;
const port = Number(process.env.SMOKE_WEB_PORT || 3100);
const web = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "start", "-p", String(port), "-H", "127.0.0.1"], {
  cwd: path.resolve("apps/web"),
  env: { ...process.env, NODE_ENV: "production", SITE_PREVIEW_MODE: "", TURNSTILE_SITE_KEY: "", NEXT_TELEMETRY_DISABLED: "1", STRAPI_PUBLIC_URL: `http://127.0.0.1:${cmsPort}`, STRAPI_SERVER_TOKEN: "smoke-token" },
  stdio: ["ignore", "pipe", "pipe"]
});
let output = "";
web.stdout.on("data", chunk => { output += chunk; });
web.stderr.on("data", chunk => { output += chunk; });
const base = `http://127.0.0.1:${port}`;
const submit = value => fetch(`${base}/api/inquiries`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value), signal: AbortSignal.timeout(15_000) });

try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (web.exitCode !== null) throw new Error(output);
    try { ready = (await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2_000) })).ok; } catch {}
    if (ready) break;
    await delay(250);
  }
  assert.ok(ready, `Next.js did not become ready: ${output}`);
  const home = await fetch(base, { signal: AbortSignal.timeout(15_000) });
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.ok(html.includes('ZHUDUO'));
  assert.ok(html.includes(demo.products[0].title));
  assert.equal((await submit(null)).status, 400);
  assert.equal((await submit({ email: "invalid" })).status, 400);
  assert.equal(records.length, 0);
  const payload = { name: "Alex", email: "alex@example.com", country: "UK", message: "Six modules", status: "won", internalNotes: "private" };
  const saved = await submit(payload);
  assert.equal(saved.status, 201);
  assert.equal((await saved.json()).id, "smoke-1");
  assert.equal(records.length, 1);
  assert.equal("status" in records[0], false);
  assert.equal("internalNotes" in records[0], false);
  assert.equal((await submit({ ...payload, name: "Upstream failure" })).status, 502);
  assert.equal((await submit({ ...payload, name: "Missing acknowledgement" })).status, 502);
  assert.equal((await submit(payload)).status, 429);
  assert.equal(records.length, 1);
  console.log("PASS: production homepage, validation, private-field stripping, CMS acknowledgement, upstream failure, and rate limiting.");
} finally {
  web.kill();
  cms.closeAllConnections();
  await new Promise(resolve => cms.close(resolve));
}
