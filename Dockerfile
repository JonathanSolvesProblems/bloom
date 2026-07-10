# Bloom on a plain Docker host (OVH), behind the box's existing Traefik.
# Three stages so the runtime image carries no build toolchain and no secrets.

# ---------- deps ----------
FROM node:22-slim AS deps
WORKDIR /app
# Prisma needs openssl present to pick its engine/TLS.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# postinstall runs `prisma generate`, so the schema and its config must exist.
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# ---------- builder ----------
FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Regenerate against the full source: the client is emitted to src/generated/prisma,
# which .dockerignore deliberately excludes so a stale copy can never ship.
RUN npx prisma generate

# `next build` imports modules that construct the Neon adapter at module scope,
# so it needs a syntactically valid URL. This is a throwaway value that never
# leaves the build stage; the real one arrives at runtime via env_file.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ARG NEXT_PUBLIC_APP_URL="https://bloom.jonathanandrei.com"
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- runner ----------
FROM node:22-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 1001 nextjs

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/ >/dev/null || exit 1

CMD ["node", "server.js"]
