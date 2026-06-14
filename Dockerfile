# check=skip=SecretsUsedInArgOrEnv,UndefinedVar

ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_APP_VERSION=""
ARG TELEMETRY_HMAC_SECRET=""
ARG TELEMETRY_ENDPOINT="https://telemetry.k8lens.dev/v1/ping"
ARG TELEMETRY_POW_DIFFICULTY="16"
ENV NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION}
ENV TELEMETRY_HMAC_SECRET=${TELEMETRY_HMAC_SECRET}
ENV TELEMETRY_ENDPOINT=${TELEMETRY_ENDPOINT}
ENV TELEMETRY_POW_DIFFICULTY=${TELEMETRY_POW_DIFFICULTY}
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ARG TELEMETRY_HMAC_SECRET=""
ARG TELEMETRY_ENDPOINT="https://telemetry.k8lens.dev/v1/ping"
ARG TELEMETRY_POW_DIFFICULTY="16"

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TELEMETRY_DISABLED="" \
    TELEMETRY_HMAC_SECRET=${TELEMETRY_HMAC_SECRET} \
    TELEMETRY_ENDPOINT=${TELEMETRY_ENDPOINT} \
    TELEMETRY_POW_DIFFICULTY=${TELEMETRY_POW_DIFFICULTY}

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

LABEL org.opencontainers.image.title="k8lens-app" \
    org.opencontainers.image.description="K8Lens — a web UI for browsing and managing Kubernetes clusters" \
    org.opencontainers.image.source="https://github.com/CodeScapes-dev/k8lens-app" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.vendor="Atharva Unde" \
    org.opencontainers.image.authors="hello@atharvaunde.dev" \
    org.opencontainers.image.documentation="https://github.com/CodeScapes-dev/k8lens-app/blob/main/README.md"
