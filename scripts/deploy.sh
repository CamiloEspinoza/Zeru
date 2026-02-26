#!/usr/bin/env bash
# Blue-green zero-downtime deployment script.
# Usage: deploy.sh <image-tag>
# Called by GitHub Actions over SSH.

set -euo pipefail

IMAGE_TAG="${1:-latest}"
ZERU_DIR="/opt/zeru"
ACTIVE_FILE="$ZERU_DIR/.active"
NGINX_UPSTREAM_CONF="/etc/nginx/conf.d/zeru-upstream.conf"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
die() { log "ERROR: $*" >&2; exit 1; }

# ─── 1. Determine colors ─────────────────────────────────────────────────────
if [[ -f "$ACTIVE_FILE" ]]; then
    ACTIVE=$(cat "$ACTIVE_FILE")
else
    ACTIVE="blue"
fi

if [[ "$ACTIVE" == "blue" ]]; then
    NEW="green"
    NEW_API_PORT=3101
    NEW_WEB_PORT=3201
else
    NEW="blue"
    NEW_API_PORT=3100
    NEW_WEB_PORT=3200
fi

log "Active: $ACTIVE → deploying to: $NEW (api=$NEW_API_PORT, web=$NEW_WEB_PORT)"

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
log "Waiting for $NEW API to be healthy on port $NEW_API_PORT..."
MAX_RETRIES=18
SLEEP_SEC=5
for i in $(seq 1 $MAX_RETRIES); do
    if curl -sf "http://127.0.0.1:$NEW_API_PORT/api" > /dev/null 2>&1; then
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
cat > "$NGINX_UPSTREAM_CONF" << EOF
upstream zeru_api { server 127.0.0.1:${NEW_API_PORT}; }
upstream zeru_web { server 127.0.0.1:${NEW_WEB_PORT}; }
EOF

nginx -t || die "Nginx config test failed"
nginx -s reload
log "Nginx reloaded — traffic now flowing to $NEW"

# ─── 7. Record new active color ───────────────────────────────────────────────
echo "$NEW" > "$ACTIVE_FILE"
log "Active color updated to: $NEW"

# ─── 8. Drain and stop old color ──────────────────────────────────────────────
log "Waiting 15s for in-flight requests to complete before stopping $ACTIVE..."
sleep 15
docker compose -f "docker-compose.$ACTIVE.yml" down
log "Stopped old $ACTIVE stack"

log "✓ Deploy complete — running: $NEW | tag: $IMAGE_TAG"
