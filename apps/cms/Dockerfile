FROM node:24.21.0-bookworm AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/cms/package.json ./apps/cms/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
RUN npm ci --omit=dev --no-audit --no-fund && mkdir -p apps/cms/node_modules

FROM node:24.21.0-bookworm AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/cms/package.json ./apps/cms/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
RUN npm ci --include=dev --no-audit --no-fund
COPY . .
# Public domain only: never pass application, database or storage credentials to builds.
ARG PUBLIC_URL
ENV NODE_ENV=production STRAPI_TELEMETRY_DISABLED=true
RUN test -n "$PUBLIC_URL" && npm run build:cms && test -f apps/cms/dist/build/index.html && mkdir -p apps/cms/public apps/cms/database

FROM node:24.21.0-bookworm AS runtime
WORKDIR /app/apps/cms
ENV NODE_ENV=production HOST=0.0.0.0 PORT=1337 STRAPI_TELEMETRY_DISABLED=true
COPY --from=dependencies --chown=node:node /app/node_modules /app/node_modules
COPY --from=dependencies --chown=node:node /app/apps/cms/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages/contracts /app/packages/contracts
COPY --from=builder --chown=node:node /app/apps/cms/package.json /app/apps/cms/tsconfig.json ./
COPY --from=builder --chown=node:node /app/apps/cms/dist ./dist
COPY --from=builder --chown=node:node /app/apps/cms/public ./public
COPY --from=builder --chown=node:node /app/apps/cms/database ./database
COPY --from=builder --chown=node:node /app/apps/cms/scripts ./scripts
USER node
EXPOSE 1337
CMD ["npm", "run", "start"]
