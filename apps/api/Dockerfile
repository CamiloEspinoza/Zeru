FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# ─── Stage 1: Prune workspace to only API and its deps ───────────────────────
FROM base AS pruner
RUN npm install -g turbo@^2
WORKDIR /app
COPY . .
RUN turbo prune @zeru/api --docker

# ─── Stage 2: Install dependencies (using pruned lockfile for layer caching) ─
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# ─── Stage 3: Build ───────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
# Start with installed state (all node_modules in correct locations)
COPY --from=installer /app .
# Overwrite with full pruned source
COPY --from=pruner /app/out/full/ .
# Prisma client must be generated before nest build (provides TypeScript types)
RUN pnpm --filter @zeru/api exec prisma generate
# Turbo respects dependsOn: builds @zeru/shared first, then @zeru/api
RUN pnpm turbo run build --filter @zeru/api

# ─── Stage 4: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production

# Copy full workspace (includes prisma CLI in devDeps — needed for migrate deploy)
COPY --from=builder /app .

EXPOSE 3000
CMD ["dumb-init", "node", "apps/api/dist/main"]
