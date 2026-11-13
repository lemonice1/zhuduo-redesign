# Strapi Modular Housing Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive English B2B website for modular housing and container buildings, with a Next.js frontend, a separate Strapi CMS for content and inquiries, PostgreSQL persistence, S3-compatible media storage, and a Docker Compose deployment target for a cloud server.

**Architecture:** `apps/web` is the public Next.js App Router site. `apps/cms` is a Strapi 5 TypeScript service that owns products, cases, articles, FAQs, settings, media metadata, and private inquiries. PostgreSQL is accessed only by Strapi; the Next.js server reads public content through Strapi Content API and writes inquiries through a server-only token. Nginx terminates HTTPS and routes the public site and CMS separately.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, next-intl, Strapi 5.57.0, PostgreSQL 14+, `@strapi/provider-upload-aws-s3`, Docker Compose, Nginx, S3-compatible object storage.

**Spec:** `docs/superpowers/specs/2026-10-09-modular-housing-design.md`

## Delivery status — 2026-10-11

Tasks 1–6 are implemented on the development branch: localized published CMS content, private inquiry persistence with admin roles and optional Turnstile, the responsive Next.js integration, production containers/Nginx/TLS configuration, and verified-backup tooling. The branch passes 80 automated tests, the web type check, the Next.js production build, HTTP smoke tests, browser integration fixtures, and deployment structure checks. See `design-qa.md` for verification limits.

Implementation choices retained from the first slice: handcrafted CSS instead of Tailwind, a single English `/` route instead of `next-intl`, JS configuration compiled with the Strapi TypeScript project, and a shared custom service secret instead of a Strapi-issued API token. Product details remain a drawer. The CMS test suite uses Node.js 24's native TypeScript support; the shared runtime contract is JS with TypeScript declarations.

Task 7 remains environment acceptance: the VM at `192.168.200.7` now serves this branch's updated homepage and both web/CMS health endpoints return 200. The VM still has no Strapi administrator, no published `zh-Hans` content, and no verified real inquiry, media upload, Turnstile, TLS, or isolated restore rehearsal. Do not treat the full production goal as complete until those checks pass.

## Global Constraints

- Keep the public copy original; do not copy the reference site's brand, text, certificates, contacts, or case studies.
- Use the approved visual direction: white `#FFFFFF`, cool gray `#F2F5F7`, slate blue `#193B50`, copper `#BC7148`, ink `#162832`, and gray-blue `#627784`.
- The first public slice is one English homepage with working product switching, product detail drawer, application selection, FAQ accordion, mobile navigation, and inquiry validation.
- Public content may be published and localized; `inquiry` is private, has no draft/publish workflow, and is not localized.
- Do not invent factory scale, certifications, delivery times, prices, customer names, or completed projects.
- MinIO must be treated as an S3-compatible endpoint. Do not add a new production MinIO image until the user's existing instance or a maintained distribution is confirmed.
- Secrets stay in environment variables. Never commit database, Strapi, S3, SMTP, or API-token values.
- PostgreSQL is managed only by Strapi. Next.js never connects directly to PostgreSQL.
- Public media can be anonymously read through a dedicated media hostname; inquiry attachments and customer information remain private.
- Use Node.js 24 LTS for local and deployment images; Strapi 5.57.0 accepts Node `>=20.0.0 <=26.x.x`.
- Nginx is the only public entry point in production; Strapi, PostgreSQL, and object storage use the private Docker network.

---

### Task 1: Workspace and service contracts

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `README.md`
- Create: `apps/web/README.md`
- Create: `apps/cms/README.md`
- Create: `packages/contracts/src/index.ts`
- Test: `tests/contracts/content-contract.test.ts`

**Interfaces:**
- Produces the root workspace commands `npm run dev:web`, `npm run dev:cms`, `npm run build:web`, and `npm run build:cms`.
- Produces the public content contract for `products`, `application`, `faq`, and `site-settings`.
- Produces the private inquiry payload contract: `{ name, email, country, productType, quantity, message, source, website }`, where `website` is a honeypot string that must remain empty.

- [ ] **Step 1: Write the failing contract test**

Create `tests/contracts/content-contract.test.ts` with `node:test` and `node:assert/strict`; run it through the pinned TypeScript test loader configured in the root scripts. Assert that the exported contract accepts a product with `slug`, `title`, `summary`, `category`, `imageUrl`, and `customizableOptions`, and rejects an inquiry with an invalid email or missing `message`.

- [ ] **Step 2: Run the contract test and confirm it fails**

Run `npm run test:contracts`.
Expected: FAIL because the contract module does not exist.

- [ ] **Step 3: Add the minimal shared contract**

Create `packages/contracts/src/index.ts` with the TypeScript types and a small runtime validator used by the test and the frontend server route. Add a root `package.json` workspace entry for `packages/contracts`, `apps/web`, and `apps/cms`.

- [ ] **Step 4: Run the contract test and confirm it passes**

Run `npm run test:contracts`.
Expected: PASS with invalid email and missing message rejected.

- [ ] **Step 5: Document environment names and scripts**

Add names only to `.env.example`: `DATABASE_URL`, `STRAPI_PUBLIC_URL`, `STRAPI_SERVER_TOKEN`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`, `S3_FORCE_PATH_STYLE`, `MEDIA_PUBLIC_URL`, `NEXT_PUBLIC_SITE_URL`, `TURNSTILE_SECRET_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASSWORD`.

### Task 2: Strapi CMS foundation and content models

**Files:**
- Create: `apps/cms/package.json`
- Create: `apps/cms/tsconfig.json`
- Create: `apps/cms/config/database.ts`
- Create: `apps/cms/config/server.ts`
- Create: `apps/cms/config/plugins.ts`
- Create: `apps/cms/src/api/product/content-types/product/schema.json`
- Create: `apps/cms/src/api/project-case/content-types/project-case/schema.json`
- Create: `apps/cms/src/api/article/content-types/article/schema.json`
- Create: `apps/cms/src/api/certificate/content-types/certificate/schema.json`
- Create: `apps/cms/src/api/faq/content-types/faq/schema.json`
- Create: `apps/cms/src/api/site-setting/content-types/site-setting/schema.json`
- Create: `apps/cms/src/api/inquiry/content-types/inquiry/schema.json`
- Create: `apps/cms/src/index.ts`
- Test: `apps/cms/tests/content-models.test.ts`

**Interfaces:**
- Strapi exposes read-only public Content API routes for published products, cases, articles, FAQs, and site settings.
- Strapi exposes inquiry creation only through the custom server-side route created in Task 3.
- `inquiry` fields include `status` (`new`, `qualified`, `quoted`, `won`, `lost`), `internalNotes`, and `createdAt`; API permissions hide these from public clients.

- [ ] **Step 1: Write the failing model test**

Create `apps/cms/tests/content-models.test.ts` that loads the schema JSON files and asserts each required content type exists, `product.slug` is unique, `product.title` is localized, and `inquiry.internalNotes` is private.

- [ ] **Step 2: Run the model test and confirm it fails**

Run `node --test apps/cms/tests/content-models.test.ts`.
Expected: FAIL because the Strapi project and schema files do not exist.

- [ ] **Step 3: Scaffold Strapi 5 in TypeScript**

Run `npx create-strapi@5.57.0 apps/cms --typescript --no-run --no-example --skip-cloud` from the workspace root. Keep the generated Strapi files and replace only the configuration and schemas listed in this task.

- [ ] **Step 4: Configure PostgreSQL**

Set `config/database.ts` to use the `postgres` client and `DATABASE_URL`, with a Docker-safe pool minimum of `0`. Do not add SQLite as a production fallback.

- [ ] **Step 5: Add the content schemas**

Define products, cases, articles, certificates, FAQs, and settings with only fields needed by the approved homepage and future detail pages. Enable draft/publish and localization on public content. Define inquiry as a private collection without draft/publish or localization.

- [ ] **Step 6: Configure the server and public URL**

Set `HOST=0.0.0.0`, `PORT=1337`, `PUBLIC_URL`, `IS_PROXIED=true`, `MAX_IPS_COUNT=1`, and disable remote transfers by default. Keep content API authentication disabled only for the explicitly public read routes; admin routes remain authenticated.

- [ ] **Step 7: Run the model test and Strapi build**

Run `node --test apps/cms/tests/content-models.test.ts` and `npm.cmd --prefix apps/cms run build`.
Expected: model test passes and the admin panel builds without schema errors.

### Task 3: Strapi media provider, permissions, and inquiry API

**Files:**
- Modify: `apps/cms/config/plugins.ts`
- Create: `apps/cms/src/api/inquiry/routes/inquiry.ts`
- Create: `apps/cms/src/api/inquiry/controllers/inquiry.ts`
- Create: `apps/cms/src/api/inquiry/services/inquiry.ts`
- Create: `apps/cms/src/api/inquiry/validators/inquiry.ts`
- Create: `apps/cms/src/policies/rate-limit-inquiry.ts`
- Create: `apps/cms/src/index.ts`
- Test: `apps/cms/tests/inquiry-validation.test.ts`
- Test: `apps/cms/tests/inquiry-route.test.ts`

**Interfaces:**
- `POST /api/inquiries` accepts the inquiry payload from the shared contract and returns `{ id, status: 'received' }` only after Strapi persists it.
- The public route never accepts `status` or `internalNotes` from the caller.
- The Next.js server uses `STRAPI_SERVER_TOKEN`; browsers never receive that token.

- [ ] **Step 1: Write the failing validation tests**

Test that empty name, invalid email, empty country, and empty message return field errors; a non-empty honeypot returns a generic rejection; a valid request returns normalized trimmed values.

- [ ] **Step 2: Run validation tests and confirm failure**

Run `node --test apps/cms/tests/inquiry-validation.test.ts`.
Expected: FAIL because the validator does not exist.

- [ ] **Step 3: Implement validation and normalization**

Create `validators/inquiry.ts` with an explicit schema and max lengths: name 120, email 254, country 80, productType 120, quantity 40, message 4000, source 120. Return structured field errors without echoing sensitive internals.

- [ ] **Step 4: Implement the custom route and controller**

Create the route with `auth: false`, attach the rate-limit policy, and have the controller call the inquiry service. The service writes only approved fields, sets `status: 'new'`, and returns the created identifier.

- [ ] **Step 5: Configure S3-compatible media storage**

Configure `@strapi/provider-upload-aws-s3` with `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`, `S3_FORCE_PATH_STYLE`, and `MEDIA_PUBLIC_URL`. Keep media writes authenticated. Use public URLs only for the public media collection; customer attachments remain private or are excluded from the first slice.

- [ ] **Step 6: Configure roles and permissions**

Create a public role that can read published public content and create no content except through the custom inquiry route. Create an operations role that can manage public content. Create a sales role that can read and update inquiries but cannot edit products or site settings. Verify the custom route strips internal fields from unauthenticated requests.

- [ ] **Step 7: Add rate limiting and spam checks**

Limit inquiry submissions by IP and time window in the policy, reject the honeypot, and add an optional Turnstile verification hook controlled by `TURNSTILE_SECRET_KEY`. The server-side Turnstile call is required when the widget is enabled.

- [ ] **Step 8: Run API tests and build**

Run `node --test apps/cms/tests/inquiry-validation.test.ts apps/cms/tests/inquiry-route.test.ts` and `npm.cmd --prefix apps/cms run build`.
Expected: validation, route permissions, media configuration, and the Strapi build pass.

### Task 4: Next.js public homepage and UI interactions

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/app/[locale]/layout.tsx`
- Create: `apps/web/app/[locale]/page.tsx`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/components/site-header.tsx`
- Create: `apps/web/components/hero.tsx`
- Create: `apps/web/components/product-selector.tsx`
- Create: `apps/web/components/product-drawer.tsx`
- Create: `apps/web/components/application-selector.tsx`
- Create: `apps/web/components/process-section.tsx`
- Create: `apps/web/components/faq-accordion.tsx`
- Create: `apps/web/components/inquiry-form.tsx`
- Create: `apps/web/components/site-footer.tsx`
- Create: `apps/web/lib/content.ts`
- Create: `apps/web/lib/validation.ts`
- Create: `apps/web/messages/en.json`
- Create: `apps/web/public/images/README.md`
- Test: `apps/web/tests/validation.test.ts`
- Test: `apps/web/tests/inquiry-form.test.tsx`

**Interfaces:**
- `lib/content.ts` returns typed public content from Strapi and maps missing optional fields to safe empty states.
- `inquiry-form.tsx` receives optional `productType` and `application` defaults and calls `/api/inquiries`.
- `product-selector.tsx` exposes the selected product to the drawer and inquiry form without duplicating product records.

- [ ] **Step 1: Write the failing validation test**

Test that a valid email and non-empty required fields pass, while invalid email and empty message return field errors. Test that the selected product is retained in the outgoing payload.

- [ ] **Step 2: Run the frontend test and confirm failure**

Run `npm.cmd --prefix apps/web test -- validation.test.ts`.
Expected: FAIL because the frontend project and validation module do not exist.

- [ ] **Step 3: Scaffold Next.js and install UI dependencies**

Create the App Router TypeScript project with Tailwind CSS, `next-intl`, `zod`, and the chosen icon package. Configure `/en` as the initial locale and redirect `/` to `/en`.

- [ ] **Step 4: Implement the approved visual system**

Set the color tokens, type scale, max content width, non-symmetrical hero, copper primary action, slate product selector, and responsive single-column mobile layout in `globals.css` and the components. Use real user media when supplied; until then, render the media slot with a clearly labeled local demo asset documented in `public/images/README.md`.

- [ ] **Step 5: Implement the homepage sections**

Render the hero, product selector, applications, customization process, manufacturing proof points without invented numbers, FAQs, inquiry section, and footer. Use Strapi content when configured and a small local demo dataset only for development when `STRAPI_PUBLIC_URL` is absent.

- [ ] **Step 6: Implement interactions and accessibility**

Make the mobile menu, product drawer, application selection, FAQ accordion, Escape close behavior, focus return, visible focus states, labels, and reduced-motion behavior work. Keep the main CTA anchored to the inquiry section.

- [ ] **Step 7: Run frontend tests and build**

Run `npm.cmd --prefix apps/web test`, `npm.cmd --prefix apps/web run lint`, and `npm.cmd --prefix apps/web run build`.
Expected: validation and interaction tests pass, lint has no errors, and the production build succeeds.

### Task 5: Next.js-to-Strapi integration and inquiry proxy

**Files:**
- Create: `apps/web/app/api/inquiries/route.ts`
- Modify: `apps/web/lib/content.ts`
- Modify: `apps/web/components/inquiry-form.tsx`
- Modify: `apps/web/next.config.ts`
- Create: `apps/web/tests/content-client.test.ts`
- Create: `apps/web/tests/inquiry-route.test.ts`

**Interfaces:**
- Public reads use the Strapi API with `populate` limited to fields needed for the current page.
- `/api/inquiries` validates the shared payload, forwards it server-side to Strapi, and returns a stable public response shape.
- The browser never sees `STRAPI_SERVER_TOKEN` or other server-only environment variables.

- [ ] **Step 1: Write failing integration tests**

Test that the content client maps a published Strapi product response to the frontend product type, and that the inquiry route rejects malformed input before contacting Strapi.

- [ ] **Step 2: Run tests and confirm failure**

Run `npm.cmd --prefix apps/web test -- content-client.test.ts inquiry-route.test.ts`.
Expected: FAIL because the integration modules do not exist.

- [ ] **Step 3: Implement the server-only content client**

Create `lib/content.ts` with typed fetch helpers, a small revalidation interval for public content, and a safe fallback used only in local development. Do not expose Strapi admin tokens to client components.

- [ ] **Step 4: Implement the inquiry proxy route**

Create `app/api/inquiries/route.ts` to parse JSON, validate the honeypot and fields, call Strapi's custom route with `Authorization: Bearer ${STRAPI_SERVER_TOKEN}`, and return `201` only when Strapi confirms persistence. Return `400` for field errors, `429` for rate limits, and `502` for upstream failure without claiming success.

- [ ] **Step 5: Connect the form states**

Add idle, submitting, field error, upstream failure, and saved-success states. When saved, show the inquiry reference returned by Strapi. Keep email notifications separate from persistence status.

- [ ] **Step 6: Run integration tests and build**

Run `npm.cmd --prefix apps/web test`, `npm.cmd --prefix apps/web run lint`, and `npm.cmd --prefix apps/web run build` with a test Strapi URL and token.

### Task 6: Cloud-server deployment

**Files:**
- Create: `docker-compose.yml`
- Create: `apps/web/Dockerfile`
- Create: `apps/cms/Dockerfile`
- Create: `deploy/nginx/nginx.conf`
- Create: `deploy/nginx/conf.d/site.conf`
- Create: `deploy/backup/backup.sh`
- Create: `deploy/README.md`
- Modify: `.env.example`

**Interfaces:**
- `docker compose up -d postgres cms web nginx` starts the site stack when an external S3-compatible endpoint is configured.
- Nginx routes `www.example.com` to Next.js, `cms.example.com` to Strapi, and `media.example.com` to the public media endpoint only when that endpoint is intentionally exposed.
- `GET /_health` returns an uptime response for the CMS; the frontend exposes a lightweight health route.

- [ ] **Step 1: Write the deployment smoke test**

Create `tests/deployment/compose-config.test.ts` that parses `docker-compose.yml` and asserts services `postgres`, `cms`, `web`, and `nginx` exist, PostgreSQL has a named volume, and CMS credentials are sourced from environment variables.

- [ ] **Step 2: Run the smoke test and confirm failure**

Run `node --test tests/deployment/compose-config.test.ts`.
Expected: FAIL because the compose file does not exist.

- [ ] **Step 3: Add production Dockerfiles and Compose services**

Use multi-stage Node 24 images, run as a non-root application user where supported, expose only internal ports, mount PostgreSQL data, and keep S3 credentials out of the image. Pin image tags rather than using floating `latest` tags for the application services.

- [ ] **Step 4: Configure Nginx and TLS boundaries**

Add HTTPS reverse-proxy configuration, request size limits for media uploads, security headers, separate CMS and site hostnames, and no public route to PostgreSQL or the S3 management console.

- [ ] **Step 5: Add backup instructions and script**

Back up PostgreSQL with `pg_dump`, mirror object storage to a separate backup target, record restore steps, and document that a single cloud server is not high availability.

- [ ] **Step 6: Run deployment checks**

Run `node --test tests/deployment/compose-config.test.ts`, `docker compose config`, and the application builds. In an environment with Docker and DNS, run the stack and verify the public site, CMS login, media upload, published content read, and inquiry write/read permissions.

### Task 7: End-to-end verification and handoff

**Files:**
- Create: `design-qa.md`
- Create: `docs/operations/strapi-content-workflow.md`
- Create: `docs/operations/inquiry-workflow.md`

- [ ] **Step 1: Run the complete automated verification**

Run the contract tests, Strapi model and inquiry tests, frontend tests, both builds, `docker compose config`, and any available browser smoke tests.

- [ ] **Step 2: Verify the core browser flow**

Check desktop and mobile layouts, keyboard navigation, reduced motion, product switching, drawer close/focus return, FAQ, mobile menu, invalid inquiry, rate-limit response, successful persistence, and the CMS inquiry record. If no approved browser is available, record the browser verification as blocked rather than claiming it passed.

- [ ] **Step 3: Write the QA result**

Record the tested URLs, viewport sizes, core interactions, build/test commands, known missing business inputs, and whether the final result is `passed` or `blocked`. Resolve all P0/P1/P2 issues before handoff.

- [ ] **Step 4: Document the operating workflow**

Explain how an operator publishes a product, uploads public media, localizes a product, and how sales views, updates, and exports an inquiry without exposing internal notes publicly.

