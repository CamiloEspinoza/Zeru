# Zeru ERP

ERP multitenant construido como monorepo con Turborepo.

## Stack

- **Backend**: NestJS + Prisma + PostgreSQL
- **Frontend**: Next.js + shadcn/ui (Mira/Teal) + Tailwind CSS v4
- **Shared**: Tipos TypeScript + Zod schemas
- **Infra**: Docker Compose (PostgreSQL 16 + Redis)

## Inicio rápido

```bash
# 1. Copiar variables de entorno
cp .env.example .env

# 2. Levantar servicios
docker compose up -d

# 3. Instalar dependencias
pnpm install

# 4. Generar cliente Prisma y correr migraciones
pnpm db:generate
pnpm db:migrate

# 5. Seed de datos iniciales
pnpm db:seed

# 6. Desarrollo
pnpm dev
```

## Estructura

```
zeru/
├── apps/
│   ├── api/          → NestJS backend (puerto 3001)
│   └── web/          → Next.js frontend (puerto 3000)
├── packages/
│   └── shared/       → @zeru/shared (tipos, schemas, utils)
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

## Multitenancy

Row-level con `tenantId` en cada modelo. El tenant se resuelve via header `x-tenant-id` o desde el JWT.
