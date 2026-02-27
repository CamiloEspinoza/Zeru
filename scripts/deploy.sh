#!/usr/bin/env bash
# Blue-green zero-downtime deployment script.
# Usage: deploy.sh <image-tag>
# Called by GitHub Actions over SSH.
#
# Supports two modes:
#   - Traefik mode:  Nginx runs as a container (zeru-nginx), upstream conf
#                    is written via a shared Docker volume.
#   - Standalone:    Nginx runs on the host, upstream conf is written to
#                    /etc/nginx/conf.d/zeru-upstream.conf (legacy).

set -euo pipefail

IMAGE_TAG="${1:-latest}"
ZERU_DIR="/opt/zeru"
ACTIVE_FILE="$ZERU_DIR/.active"
NGINX_CONTAINER="zeru-nginx"
NGINX_UPSTREAM_DIR="/etc/nginx/conf.d/upstream"
NGINX_UPSTREAM_FILE="zeru-upstream.conf"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
die() { log "ERROR: $*" >&2; exit 1; }

# ─── Detect mode: containerized Nginx or host Nginx ─────────────────────────
if docker inspect "$NGINX_CONTAINER" &>/dev/null; then
    NGINX_MODE="container"
    log "Detected containerized Nginx ($NGINX_CONTAINER)"
else
    NGINX_MODE="host"
    log "Using host Nginx"
fi

# ─── 1. Determine colors ─────────────────────────────────────────────────────
if [[ -f "$ACTIVE_FILE" ]]; then
    ACTIVE=$(cat "$ACTIVE_FILE")
else
    ACTIVE="blue"
fi

if [[ "$ACTIVE" == "blue" ]]; then
    NEW="green"
else
    NEW="blue"
fi

log "Active: $ACTIVE → deploying to: $NEW"

cd "$ZERU_DIR"

# ─── 2. Pull new images ───────────────────────────────────────────────────────
log "Pulling images for tag: $IMAGE_TAG"
export IMAGE_TAG
docker compose -f "docker-compose.$NEW.yml" pull

# ─── 3. Start idle color ──────────────────────────────────────────────────────
log "Starting $NEW stack..."
docker compose -f "docker-compose.$NEW.yml" up -d --remove-orphans

# ─── 4. Run Prisma migrations ─────────────────────────────────────────────────
log "Running database migrations..."
docker exec "zeru-api-$NEW" npx prisma migrate deploy || die "Prisma migration failed"

# ─── 5. Health check (max 90 s) ───────────────────────────────────────────────
log "Waiting for $NEW API to be healthy..."
MAX_RETRIES=18
SLEEP_SEC=5
for i in $(seq 1 $MAX_RETRIES); do
    if docker exec "zeru-api-$NEW" wget -qO- http://localhost:3000/api > /dev/null 2>&1; then
        log "API health check passed (attempt $i)"
        break
    fi
    if [[ $i -eq $MAX_RETRIES ]]; then
        log "Health check failed after $((MAX_RETRIES * SLEEP_SEC))s — rolling back"
        docker compose -f "docker-compose.$NEW.yml" down
        die "Deployment failed: $NEW API did not become healthy"
    fi
    log "  attempt $i/$MAX_RETRIES — waiting ${SLEEP_SEC}s..."
    sleep $SLEEP_SEC
done

# ─── 6. Switch Nginx upstream to new color ────────────────────────────────────
log "Switching Nginx upstream to $NEW..."

UPSTREAM_CONTENT="upstream zeru_api { server zeru-api-${NEW}:3000; }
upstream zeru_web { server zeru-web-${NEW}:3000; }"

if [[ "$NGINX_MODE" == "container" ]]; then
    # Write upstream conf into the shared volume via the container
    docker exec "$NGINX_CONTAINER" sh -c "mkdir -p $NGINX_UPSTREAM_DIR && echo '$UPSTREAM_CONTENT' > $NGINX_UPSTREAM_DIR/$NGINX_UPSTREAM_FILE"
    docker exec "$NGINX_CONTAINER" nginx -t || die "Nginx config test failed"
    docker exec "$NGINX_CONTAINER" nginx -s reload
else
    # Legacy: write directly to host filesystem
    echo "$UPSTREAM_CONTENT" > "/etc/nginx/conf.d/$NGINX_UPSTREAM_FILE"
    nginx -t || die "Nginx config test failed"
    nginx -s reload
fi

log "Nginx reloaded — traffic now flowing to $NEW"

# ─── 7. Record new active color ───────────────────────────────────────────────
echo "$NEW" > "$ACTIVE_FILE"
log "Active color updated to: $NEW"

# ─── 8. Drain and stop old color ──────────────────────────────────────────────
log "Waiting 15s for in-flight requests to complete before stopping $ACTIVE..."
sleep 15
docker compose -f "docker-compose.$ACTIVE.yml" down
log "Stopped old $ACTIVE stack"

log "Deploy complete — running: $NEW | tag: $IMAGE_TAG"
