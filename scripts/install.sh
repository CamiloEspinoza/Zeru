#!/usr/bin/env bash
# One-command Ubuntu 22.04 / 24.04 bootstrap for Zeru.
# Run as root on a fresh server:
#
#   curl -fsSL https://raw.githubusercontent.com/CamiloEspinoza/Zeru/main/scripts/install.sh | bash
#
# The script is idempotent — safe to re-run after partial failures.
#
# Supports two modes:
#   - Traefik mode:  Detected automatically when a Traefik container or its
#                    Docker network already exists. Nginx runs inside the Zeru
#                    Docker stack; host Nginx, Certbot, and UFW are skipped.
#   - Standalone:    Nginx is installed on the host with Certbot for TLS.

set -euo pipefail

REPO_URL="https://github.com/CamiloEspinoza/Zeru.git"
ZERU_DIR="/opt/zeru"
DEPLOY_USER="deploy"
GH_CLONE_TOKEN=""   # Set via env: GH_CLONE_TOKEN=ghp_xxx bash install.sh

log()  { echo -e "\033[1;32m[ZERU INSTALL]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
die()  { echo -e "\033[1;31m[ERROR]\033[0m $*" >&2; exit 1; }
ask()  { read -rp "$(echo -e "\033[1;36m$1\033[0m ") " "$2"; }

[[ $EUID -ne 0 ]] && die "Run as root: sudo bash install.sh"

# ─── Detect Traefik ──────────────────────────────────────────────────────────
HAS_TRAEFIK=false
TRAEFIK_NETWORK=""

# Check for a running or stopped Traefik container
if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qi traefik; then
    HAS_TRAEFIK=true
    # Try to find the Traefik network automatically
    TRAEFIK_NETWORK=$(docker inspect traefik --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null | awk '{print $1}' || true)
fi

# Fallback: check for known Traefik networks
if [[ "$HAS_TRAEFIK" == "false" ]]; then
    for net in infrastructure_staging-network infrastructure_production-network; do
        if docker network inspect "$net" &>/dev/null; then
            HAS_TRAEFIK=true
            TRAEFIK_NETWORK="$net"
            break
        fi
    done
fi

if [[ "$HAS_TRAEFIK" == "true" ]]; then
    log "Traefik detected (network: ${TRAEFIK_NETWORK:-auto})"
    log "Mode: Nginx will run as a container behind Traefik"
else
    log "No Traefik detected"
    log "Mode: Nginx will be installed on the host with Certbot"
fi

# ─── Step 1: Update system ────────────────────────────────────────────────────
log "1/11 — Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl git ufw wget

# ─── Step 2: Install Docker ───────────────────────────────────────────────────
log "2/11 — Installing Docker..."
if command -v docker &>/dev/null; then
    warn "Docker already installed: $(docker --version)"
else
    curl -fsSL https://get.docker.com | bash
    systemctl enable --now docker
fi
log "Docker: $(docker --version)"
log "Docker Compose: $(docker compose version)"

# ─── Step 3: Install Nginx + Certbot (standalone mode only) ──────────────────
if [[ "$HAS_TRAEFIK" == "true" ]]; then
    log "3/11 — Skipping host Nginx + Certbot (Traefik handles TLS)"
else
    log "3/11 — Installing Nginx + Certbot..."
    apt-get install -y -qq nginx certbot python3-certbot-nginx
    systemctl enable --now nginx
    log "Nginx: $(nginx -v 2>&1)"
fi

# ─── Step 4: Configure firewall (standalone mode only) ───────────────────────
if [[ "$HAS_TRAEFIK" == "true" ]]; then
    log "4/11 — Skipping UFW configuration (Traefik manages ports)"
else
    log "4/11 — Configuring UFW firewall..."
    ufw allow OpenSSH
    ufw allow 'Nginx Full'
    ufw --force enable
    log "UFW status: $(ufw status | head -1)"
fi

# ─── Step 5: Create deploy user ───────────────────────────────────────────────
log "5/11 — Creating '$DEPLOY_USER' user..."
if id "$DEPLOY_USER" &>/dev/null; then
    warn "User '$DEPLOY_USER' already exists"
else
    adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"
mkdir -p "/home/$DEPLOY_USER/.ssh"
touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 700 "/home/$DEPLOY_USER/.ssh"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"

# ─── Step 6: Add SSH public key for GitHub Actions ───────────────────────────
log "6/11 — Setting up GitHub Actions SSH key..."
echo ""
echo "  Paste the PUBLIC key (zeru_deploy.pub) for GitHub Actions and press Enter."
echo "  (Generate on your local machine: ssh-keygen -t ed25519 -C 'github-actions-deploy' -f ~/.ssh/zeru_deploy -N '')"
echo ""
ask "Paste public key:" SSH_PUB_KEY
if [[ -n "$SSH_PUB_KEY" ]]; then
    if ! grep -qF "$SSH_PUB_KEY" "/home/$DEPLOY_USER/.ssh/authorized_keys" 2>/dev/null; then
        echo "$SSH_PUB_KEY" >> "/home/$DEPLOY_USER/.ssh/authorized_keys"
        log "Public key added to authorized_keys"
    else
        warn "Key already in authorized_keys"
    fi
else
    warn "No key provided — GitHub Actions SSH will not work until you add a key manually."
fi

# ─── Step 7: Clone repo and set up directory structure ───────────────────────
log "7/11 — Setting up $ZERU_DIR..."

# Build authenticated clone URL if a token was provided (required for private repos)
if [[ -n "$GH_CLONE_TOKEN" ]]; then
    CLONE_URL="${REPO_URL/https:\/\//https://${GH_CLONE_TOKEN}@}"
else
    CLONE_URL="$REPO_URL"
fi

if [[ -d "$ZERU_DIR/.git" ]]; then
    warn "Repo already cloned at $ZERU_DIR — pulling latest..."
    git -C "$ZERU_DIR" pull
else
    git clone "$CLONE_URL" "$ZERU_DIR"
fi
mkdir -p "$ZERU_DIR/scripts" "$ZERU_DIR/nginx"
chmod +x "$ZERU_DIR/scripts/deploy.sh"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$ZERU_DIR"

# ─── Step 8: Create .env.production ──────────────────────────────────────────
log "8/11 — Creating production environment file..."
if [[ -f "$ZERU_DIR/.env.production" ]]; then
    warn ".env.production already exists — skipping interactive setup. Edit manually: nano $ZERU_DIR/.env.production"
else
    echo ""
    log "You will now be prompted for production secrets. Press Ctrl+C to abort."
    echo ""

    ask "Domain name (e.g. zeruapp.com):" DOMAIN
    ask "Postgres password:" POSTGRES_PASSWORD
    JWT_SECRET=$(openssl rand -hex 32)
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    REGISTER_TOKEN=$(openssl rand -hex 20)

    cat > "$ZERU_DIR/.env.production" << EOF
# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://zeru:${POSTGRES_PASSWORD}@postgres:5432/zeru
POSTGRES_USER=zeru
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=zeru

# ── Cache ─────────────────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ── Auth ──────────────────────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRATION=7d
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# ── App ───────────────────────────────────────────────────────────────────────
NODE_ENV=production
API_PORT=3000
CORS_ORIGIN=https://${DOMAIN}
NEXT_PUBLIC_API_URL=https://${DOMAIN}/api
NEXT_PUBLIC_REGISTER_TOKEN=${REGISTER_TOKEN}
EOF

    # If Traefik mode, also write the Traefik network name
    if [[ "$HAS_TRAEFIK" == "true" && -n "$TRAEFIK_NETWORK" ]]; then
        echo "" >> "$ZERU_DIR/.env.production"
        echo "# ── Traefik ───────────────────────────────────────────────────────────────────" >> "$ZERU_DIR/.env.production"
        echo "TRAEFIK_NETWORK=${TRAEFIK_NETWORK}" >> "$ZERU_DIR/.env.production"
    fi

    chmod 600 "$ZERU_DIR/.env.production"
    chown "$DEPLOY_USER:$DEPLOY_USER" "$ZERU_DIR/.env.production"
    log ".env.production created"
fi

# Load env for docker login step
# shellcheck disable=SC2046
export $(grep -v '^#' "$ZERU_DIR/.env.production" | grep -v '^$' | xargs)

# ─── Step 9: Configure Nginx ──────────────────────────────────────────────────
if [[ "$HAS_TRAEFIK" == "true" ]]; then
    log "9/11 — Skipping host Nginx config (Nginx runs as container in infra stack)"
else
    log "9/11 — Configuring host Nginx..."
    cp "$ZERU_DIR/nginx/nginx.conf" /etc/nginx/sites-available/zeru
    ln -sf /etc/nginx/sites-available/zeru /etc/nginx/sites-enabled/zeru
    rm -f /etc/nginx/sites-enabled/default

    # Create initial upstream pointing to blue
    mkdir -p /etc/nginx/conf.d
    cat > /etc/nginx/conf.d/zeru-upstream.conf << 'EOF'
upstream zeru_api { server 127.0.0.1:3100; }
upstream zeru_web { server 127.0.0.1:3200; }
EOF

    nginx -t && systemctl reload nginx
    log "Nginx configured and reloaded"
fi

# ─── Step 10: Start infrastructure (Postgres + Redis + Nginx if Traefik) ─────
log "10/11 — Starting infrastructure services..."
docker network create zeru-infra 2>/dev/null || warn "Network 'zeru-infra' already exists"

cd "$ZERU_DIR"
docker compose -f docker-compose.infra.yml --env-file .env.production up -d
log "Waiting for services to be healthy..."
sleep 15
docker compose -f docker-compose.infra.yml --env-file .env.production ps

# ─── Step 11: First deploy ────────────────────────────────────────────────────
log "11/11 — Running first deployment..."
echo ""
warn "IMPORTANT: Before the first deploy, you must:"
warn "  1. Push code to main → GitHub Actions will build images → push to ghcr.io"
warn "  2. OR manually pull: docker pull ghcr.io/camiloespinoza/zeru/api:latest"
echo ""

ask "Pull and start blue stack now? Requires images already in ghcr.io. (y/N):" START_NOW
if [[ "${START_NOW,,}" == "y" ]]; then
    ask "GitHub username for ghcr.io login:" GH_USER
    ask "GitHub Personal Access Token (read:packages scope):" GH_TOKEN
    echo "$GH_TOKEN" | docker login ghcr.io -u "$GH_USER" --password-stdin

    export IMAGE_TAG=latest
    docker compose -f docker-compose.blue.yml --env-file .env.production pull
    docker compose -f docker-compose.blue.yml --env-file .env.production up -d

    log "Waiting 30s for API to start..."
    sleep 30

    log "Running Prisma migrations..."
    docker exec zeru-api-blue npx prisma migrate deploy

    # Write initial upstream config
    UPSTREAM_CONTENT="upstream zeru_api { server zeru-api-blue:3000; }
upstream zeru_web { server zeru-web-blue:3000; }"

    if docker inspect zeru-nginx &>/dev/null; then
        docker exec zeru-nginx sh -c "mkdir -p /etc/nginx/conf.d/upstream && echo '$UPSTREAM_CONTENT' > /etc/nginx/conf.d/upstream/zeru-upstream.conf"
        docker exec zeru-nginx nginx -s reload
    fi

    echo "blue" > "$ZERU_DIR/.active"
    chown "$DEPLOY_USER:$DEPLOY_USER" "$ZERU_DIR/.active"

    log "Verifying health..."
    docker exec zeru-api-blue wget -qO- http://localhost:3000/api > /dev/null 2>&1 && log "API OK" || warn "API not yet responding — check: docker logs zeru-api-blue"
    docker exec zeru-web-blue wget -qO- http://localhost:3000 > /dev/null 2>&1 && log "Web OK" || warn "Web not yet responding — check: docker logs zeru-web-blue"
else
    log "Skipping first deploy. Run manually later:"
    echo "  cd $ZERU_DIR"
    echo "  IMAGE_TAG=latest docker compose -f docker-compose.blue.yml --env-file .env.production up -d"
    echo "  docker exec zeru-api-blue npx prisma migrate deploy"
    echo "  echo 'blue' > $ZERU_DIR/.active"
fi

# ─── HTTPS with Certbot (standalone mode only) ───────────────────────────────
if [[ "$HAS_TRAEFIK" == "false" ]]; then
    echo ""
    ask "Configure HTTPS with Certbot now? (y/N):" SETUP_HTTPS
    if [[ "${SETUP_HTTPS,,}" == "y" ]]; then
        DOMAIN_FOR_CERT="${DOMAIN:-}"
        if [[ -z "$DOMAIN_FOR_CERT" ]]; then
            ask "Enter domain for SSL certificate:" DOMAIN_FOR_CERT
        fi
        certbot --nginx -d "$DOMAIN_FOR_CERT"
        systemctl enable certbot.timer 2>/dev/null || true
        log "HTTPS configured for $DOMAIN_FOR_CERT"
    else
        warn "Skipping HTTPS. Run later: certbot --nginx -d your-domain.com"
    fi
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    ZERU INSTALL COMPLETE                     ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  App directory : $ZERU_DIR"
echo "║  Deploy user   : $DEPLOY_USER"
echo "║  Active color  : $(cat $ZERU_DIR/.active 2>/dev/null || echo 'not set')"
if [[ "$HAS_TRAEFIK" == "true" ]]; then
echo "║  Proxy mode    : Traefik → Nginx container → app"
else
echo "║  Proxy mode    : Host Nginx + Certbot"
fi
echo "║"
echo "║  Useful commands:"
echo "║    cat $ZERU_DIR/.active            → active color"
echo "║    docker ps --format '{{.Names}}'  → running containers"
echo "║    docker logs -f zeru-api-blue     → API logs"
echo "║    $ZERU_DIR/scripts/deploy.sh <tag> → manual deploy"
echo "╚══════════════════════════════════════════════════════════════╝"
