# ── Stage 1: Build ───────────────────────────────────────────
FROM node:22-alpine AS builder

RUN npm install -g pnpm@9.15.0 && \
    apk add --no-cache openssl

WORKDIR /app

# Dependency manifests first (layer caching)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./

# Source code
COPY packages/backend ./packages/backend/
COPY packages/circuits/build ./packages/circuits/build/

# Install all dependencies, generate Prisma client, compile
# DATABASE_URL dummy — Prisma validate needs it but doesn't connect during build
RUN export DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy" && \
    pnpm install --frozen-lockfile && \
    pnpm db:generate && \
    pnpm build:backend

# ── Stage 2: Production ──────────────────────────────────────
FROM node:22-alpine AS runner

RUN npm install -g pnpm@9.15.0 && \
    apk add --no-cache openssl curl

WORKDIR /app

# Dependency manifests only (not source code)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Remove prepare script (husky requires .git), then install production deps only
RUN sed -i '/"prepare"/d' package.json && pnpm install --frozen-lockfile --prod

# Prisma schema and migrations
COPY --from=builder /app/packages/backend/prisma ./packages/backend/prisma

# Regenerate Prisma client for production target
RUN DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy" pnpm db:generate

# Compiled JavaScript
COPY --from=builder /app/dist ./dist

# Circuit build files (zkey, wasm, verification key)
COPY --from=builder /app/packages/circuits/build ./packages/circuits/build

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

# Sync database schema (safe for existing DBs with migration mismatches), then start
# Run seed manually after first deploy: node dist/backend/prisma/seed.js
CMD ["sh", "-c", "pnpm exec prisma db push --schema=packages/backend/prisma/schema.prisma --accept-data-loss && node dist/backend/src/server.js"]
