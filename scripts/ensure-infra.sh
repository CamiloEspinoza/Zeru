#!/usr/bin/env bash
# Asegura que Postgres y Redis estén corriendo antes de iniciar el dev server.
# Usa docker-compose.yml (postgres:5437, redis:6380).

set -e

COMPOSE_FILE="${1:-docker-compose.yml}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

# Docker disponible?
if ! command -v docker &>/dev/null; then
  echo "❌ Docker no está instalado o no está en PATH." >&2
  exit 1
fi

if ! docker info &>/dev/null; then
  echo "❌ Docker no está corriendo. Inicia Docker Desktop y vuelve a intentar." >&2
  exit 1
fi

if ! command -v nc &>/dev/null; then
  echo "❌ Se necesita 'nc' (netcat) para verificar los puertos. Instálalo con: brew install netcat" >&2
  exit 1
fi

# docker compose o docker-compose
if docker compose version &>/dev/null; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
else
  echo "❌ Ni 'docker compose' ni 'docker-compose' están disponibles." >&2
  exit 1
fi

echo "📦 Iniciando contenedores (Postgres, Redis)..."
$COMPOSE_CMD -f "$COMPOSE_FILE" up -d

# Esperar Postgres (localhost:5437)
echo "⏳ Esperando Postgres en localhost:5437..."
MAX=30
for i in $(seq 1 $MAX); do
  if command -v nc &>/dev/null && nc -z localhost 5437 2>/dev/null; then
    echo "✅ Postgres listo."
    break
  fi
  if [ "$i" -eq "$MAX" ]; then
    echo "❌ Postgres no respondió en 30 segundos." >&2
    exit 1
  fi
  sleep 1
done

# Esperar Redis (localhost:6380)
echo "⏳ Esperando Redis en localhost:6380..."
for i in $(seq 1 $MAX); do
  if command -v nc &>/dev/null && nc -z localhost 6380 2>/dev/null; then
    echo "✅ Redis listo."
    exit 0
  fi
  if [ "$i" -eq "$MAX" ]; then
    echo "❌ Redis no respondió en 30 segundos." >&2
    exit 1
  fi
  sleep 1
done
