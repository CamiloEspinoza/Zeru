FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# ─── Stage 1: Prune workspace to only web and its deps ───────────────────────
FROM base AS pruner
RUN npm install -g turbo@^2
WORKDIR /app
COPY . .
RUN turbo prune @zeru/web --docker

# ─── Stage 2: Install dependencies ───────────────────────────────────────────
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# ─── Stage 3: Build ───────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
# NEXT_PUBLIC_* vars must be present at build time (baked into static assets)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY --from=installer /app .
COPY --from=pruner /app/out/full/ .
# Turbo builds @zeru/shared first (dependsOn: ["^build"]), then @zeru/web
RUN pnpm turbo run build --filter @zeru/web

# ─── Stage 4: Runner (minimal — only standalone output) ──────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Next.js standalone output is self-contained (no node_modules needed)
COPY --from=builder /app/apps/web/.next/standalone ./
# Static assets must be placed beside the standalone server
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
# server.js lives at apps/web/server.js within the standalone root
CMD ["dumb-init", "node", "apps/web/server.js"]
