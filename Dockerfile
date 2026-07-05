FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/integrations/package.json packages/integrations/package.json
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages ./packages
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js imports server modules while collecting page metadata. The postgres
# client is lazy, so this non-secret build-only URL is never queried. The final
# runtime image receives the real DATABASE_URL from Docker Compose/Portainer.
ARG DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ARG APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG PUBLIC_IMAGE_HOSTS=
ENV DATABASE_URL=$DATABASE_URL
ENV APP_URL=$APP_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV PUBLIC_IMAGE_HOSTS=$PUBLIC_IMAGE_HOSTS
RUN pnpm build

FROM base AS migrator
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/db ./packages/db
COPY docker/runtime-entrypoint.sh /usr/local/bin/runtime-entrypoint
RUN chmod 755 /usr/local/bin/runtime-entrypoint
ENTRYPOINT ["/usr/local/bin/runtime-entrypoint"]
CMD ["sh", "-c", "pnpm --filter @judilen/db migrate && pnpm --filter @judilen/db bootstrap"]

FROM alpine:3.22 AS secret-init
COPY docker/init-runtime-secrets.sh /usr/local/bin/init-runtime-secrets
RUN chmod 755 /usr/local/bin/init-runtime-secrets
ENTRYPOINT ["/usr/local/bin/init-runtime-secrets"]

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY docker/runtime-entrypoint.sh /usr/local/bin/runtime-entrypoint
RUN mkdir -p /app/storage/uploads /app/storage/chat-attachments /app/apps/web/public/uploads \
  && chown -R nextjs:nodejs /app/storage /app/apps/web/public/uploads \
  && chmod 755 /usr/local/bin/runtime-entrypoint
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENTRYPOINT ["/usr/local/bin/runtime-entrypoint"]
CMD ["node", "apps/web/server.js"]
