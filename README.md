# Zeru ERP

ERP multitenant construido como monorepo con Turborepo.

## Stack

- **Backend**: NestJS + Prisma + PostgreSQL + Redis
- **Frontend**: Next.js + shadcn/ui + Tailwind CSS v4
- **Shared**: Tipos TypeScript + Zod schemas
- **Infra**: Docker Compose (PostgreSQL 17 pgvector + Redis 7)
- **Deploy**: Blue-Green con Docker + Nginx + GitHub Actions

---

## Desarrollo local

```bash
# 1. Copiar variables de entorno
cp .env.example .env

# 2. Levantar servicios de infraestructura
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

La API corre en `http://localhost:3017` y el frontend en `http://localhost:3000`.

---

## Estructura del proyecto

```
zeru/
├── apps/
│   ├── api/          → NestJS backend  (puerto 3017 dev / 3000 prod)
│   └── web/          → Next.js frontend (puerto 3000)
├── packages/
│   └── shared/       → @zeru/shared (tipos, schemas, utils)
├── nginx/            → Configuración Nginx para producción
├── scripts/
│   ├── install.sh    → Bootstrap automático en servidor Ubuntu
│   └── deploy.sh     → Script de blue-green deployment
├── docker-compose.yml         → Infra local (dev)
├── docker-compose.infra.yml   → Infra producción (Postgres + Redis)
├── docker-compose.blue.yml    → Stack blue (producción)
├── docker-compose.green.yml   → Stack green (producción)
├── .env.production.example    → Template de variables de entorno
├── turbo.json
└── pnpm-workspace.yaml
```

---

## Despliegue en producción (Ubuntu Server)

### Requisitos previos

| Requisito | Notas |
|-----------|-------|
| Servidor Ubuntu 22.04 o 24.04 | VPS o bare metal, mínimo 2 GB RAM |
| Acceso root vía SSH | Para correr el script de instalación |
| Dominio apuntando al servidor | DNS A → IP del servidor |
| Repositorio en GitHub | Con GitHub Actions habilitado |
| GitHub Container Registry | `ghcr.io` (viene incluido con GitHub) |

---

### Paso 1 — Configurar GitHub Actions

Antes de instalar el servidor, genera un par de claves SSH para que GitHub Actions pueda hacer deploys automáticos.

En tu **máquina local** ejecuta:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/zeru_deploy -N ""
```

Esto genera dos archivos:
- `~/.ssh/zeru_deploy` → clave privada (va a GitHub Secrets)
- `~/.ssh/zeru_deploy.pub` → clave pública (va al servidor)

Guarda el contenido de ambos archivos, los necesitarás en los pasos siguientes.

---

### Paso 2 — Agregar secrets en GitHub

En tu repositorio GitHub ve a **Settings → Secrets and variables → Actions** y crea estos secrets:

| Secret | Valor |
|--------|-------|
| `SSH_PRIVATE_KEY` | Contenido completo de `~/.ssh/zeru_deploy` |
| `SSH_HOST` | IP pública del servidor |
| `SSH_USER` | `deploy` (el script lo crea automáticamente) |
| `GHCR_TOKEN` | GitHub Personal Access Token con scope `write:packages` |

Para crear el `GHCR_TOKEN`: ve a **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)** y genera uno con scope `write:packages`.

---

### Paso 3 — Instalar Zeru en el servidor

Conéctate al servidor como **root** y ejecuta el script de instalación:

```bash
ssh root@tu-servidor-ip
curl -fsSL https://raw.githubusercontent.com/CamiloEspinoza/Zeru/main/scripts/install.sh | bash
```

El script es interactivo y realiza automáticamente los siguientes pasos:

1. Actualiza el sistema operativo
2. Instala Docker y Docker Compose
3. Instala Nginx y Certbot
4. Configura el firewall UFW (puertos 22, 80, 443)
5. Crea el usuario `deploy` con acceso a Docker
6. Te pide pegar la **clave pública SSH** generada en el Paso 1
7. Clona el repositorio en `/opt/zeru`
8. Te pide el **dominio** y la **contraseña de Postgres** para generar `.env.production` con secretos aleatorios
9. Configura Nginx como reverse proxy
10. Levanta PostgreSQL y Redis en Docker
11. Opcionalmente hace el primer deploy y configura HTTPS con Certbot

> El script es idempotente: es seguro volver a ejecutarlo si algo falla a mitad.

---

### Paso 4 — Primer deploy

Si en el paso anterior no hiciste el primer deploy automático, o si es la primera vez que haces push al repo:

1. Haz push de tu código a la rama `main`:
   ```bash
   git push origin main
   ```

2. GitHub Actions construirá las imágenes Docker y las publicará en `ghcr.io`.

3. Luego el workflow ejecutará `deploy.sh` en el servidor vía SSH, que:
   - Determina el color inactivo (blue/green)
   - Levanta el nuevo stack
   - Corre `prisma migrate deploy`
   - Hace health check
   - Actualiza Nginx para apuntar al nuevo stack
   - Detiene el stack anterior

> El workflow se puede ver en `.github/workflows/deploy.yml` y también puede dispararse manualmente desde **GitHub → Actions → Build & Deploy → Run workflow**.

---

### Paso 5 — Verificar que todo funciona

```bash
# Estado de los containers
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

# Logs de la API
docker logs -f zeru-api-blue

# Logs del frontend
docker logs -f zeru-web-blue

# Color activo
cat /opt/zeru/.active

# Health check manual
curl http://localhost:3100/api   # API blue
curl http://localhost:3200       # Web blue
```

---

### Comandos útiles en producción

```bash
# Deploy manual con un tag específico
/opt/zeru/scripts/deploy.sh sha-abc1234

# Deploy manual con latest
IMAGE_TAG=latest /opt/zeru/scripts/deploy.sh latest

# Ver el color activo
cat /opt/zeru/.active

# Reiniciar infraestructura (Postgres + Redis)
cd /opt/zeru && docker compose -f docker-compose.infra.yml restart

# Editar variables de entorno
nano /opt/zeru/.env.production
# (reinicia el stack después para aplicar cambios)
```

---

### Arquitectura blue-green

```
Internet → Nginx (/etc/nginx/conf.d/zeru-upstream.conf)
                     │
            ┌────────┴────────┐
            ↓                 ↓
      [blue: 3100/3200]  [green: 3101/3201]  (solo uno activo a la vez)
            │                 │
            └────────┬────────┘
                     ↓
          [zeru-infra network]
          Postgres :5432 + Redis :6379
```

En cada deploy, `deploy.sh` levanta el color inactivo, verifica que responde correctamente y luego actualiza el archivo de upstreams de Nginx y recarga la configuración sin downtime. El stack anterior se detiene después de 10 segundos para drenar conexiones.

---

### Configurar HTTPS (si no lo hiciste durante la instalación)

```bash
certbot --nginx -d tu-dominio.com
```

El certificado se renueva automáticamente via `certbot.timer`.

---

### Variables de entorno de producción

El archivo `/opt/zeru/.env.production` es generado por el script de instalación. Para referencia, ver `.env.production.example` en el repositorio:

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URL de conexión a PostgreSQL (usa hostname `postgres`) |
| `REDIS_URL` | URL de Redis (usa hostname `redis`) |
| `JWT_SECRET` | Secreto para firmar tokens JWT (32 bytes hex) |
| `ENCRYPTION_KEY` | Llave para cifrado de datos sensibles (32 bytes hex) |
| `CORS_ORIGIN` | Dominio público del frontend (ej: `https://app.zeru.cl`) |
| `NEXT_PUBLIC_API_URL` | URL pública de la API (ej: `https://app.zeru.cl/api`) |
| `NEXT_PUBLIC_REGISTER_TOKEN` | Token de invitación para nuevos usuarios |

---

## Multitenancy

Row-level con `tenantId` en cada modelo. El tenant se resuelve via header `x-tenant-id` o desde el JWT.

## API Pública

Zeru expone una API REST pública para integraciones de terceros, autenticada con API Keys con scopes granulares. La documentación está disponible en `/docs`.
