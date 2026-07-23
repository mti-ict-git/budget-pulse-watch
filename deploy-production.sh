#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.production.yml"
ENV_FILE="$ROOT_DIR/backend/.env.production"
ENV_TEMPLATE="$ROOT_DIR/backend/.env.production.template"
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://localhost:5004/health}"
FRONTEND_HEALTH_URL="${FRONTEND_HEALTH_URL:-http://localhost:9007/health}"
SKIP_MIGRATIONS="${SKIP_MIGRATIONS:-0}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Required command '$1' is not installed."
    exit 1
  fi
}

require_file() {
  if [ ! -f "$1" ]; then
    echo "ERROR: Required file not found: $1"
    exit 1
  fi
}

env_has_key() {
  local key="$1"
  grep -Eq "^[[:space:]]*${key}=" "$ENV_FILE"
}

env_get_value() {
  local key="$1"
  awk -F= -v lookup_key="$key" '
    $0 !~ /^[[:space:]]*#/ && $1 == lookup_key {
      sub(/^[^=]+=/, "", $0)
      print $0
      exit
    }
  ' "$ENV_FILE"
}

require_env_key() {
  local key="$1"
  if ! env_has_key "$key"; then
    echo "ERROR: Missing '$key' in $ENV_FILE"
    exit 1
  fi
}

wait_for_url() {
  local url="$1"
  local label="$2"
  local timeout_seconds="${3:-180}"
  local start_time
  start_time="$(date +%s)"

  echo "Waiting for $label at $url ..."
  while true; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "$label is healthy."
      return 0
    fi

    if [ $(( $(date +%s) - start_time )) -ge "$timeout_seconds" ]; then
      echo "ERROR: Timed out waiting for $label."
      return 1
    fi

    sleep 5
  done
}

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

echo "Starting production deployment..."

require_command docker
require_command curl
require_file "$COMPOSE_FILE"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$ENV_TEMPLATE" ]; then
    cp "$ENV_TEMPLATE" "$ENV_FILE"
    echo "Created $ENV_FILE from template. Fill in the real values first, then run the script again."
  else
    echo "ERROR: Missing $ENV_FILE and no template was found."
  fi
  exit 1
fi

require_env_key "DB_SERVER"
require_env_key "DB_NAME"
require_env_key "DB_USER"
require_env_key "DB_PASSWORD"
require_env_key "JWT_SECRET"
require_env_key "SETTINGS_ENCRYPTION_KEY"

if env_has_key "PORT"; then
  current_port="$(env_get_value "PORT")"
  if [ "$current_port" != "3001" ]; then
    echo "ERROR: backend/.env.production must set PORT=3001. Current value: $current_port"
    exit 1
  fi
fi

cifs_keys=("CIFS_SERVER" "CIFS_SHARE" "CIFS_USERNAME" "CIFS_PASSWORD")
cifs_present=0
for key in "${cifs_keys[@]}"; do
  if env_has_key "$key"; then
    cifs_present=$((cifs_present + 1))
  fi
done

if [ "$cifs_present" -ne 0 ] && [ "$cifs_present" -ne 4 ]; then
  echo "ERROR: CIFS configuration must be complete. Set all of: CIFS_SERVER, CIFS_SHARE, CIFS_USERNAME, CIFS_PASSWORD"
  exit 1
fi

mkdir -p "$ROOT_DIR/backend/data" "$ROOT_DIR/backend/temp" "$ROOT_DIR/backend/artifacts"

echo "Stopping existing containers..."
compose down --remove-orphans

echo "Building and starting containers..."
compose up -d --build --remove-orphans

wait_for_url "$BACKEND_HEALTH_URL" "backend" 240

if [ "$SKIP_MIGRATIONS" != "1" ]; then
  echo "Running database migrations..."
  compose exec -T backend npm run db:migrate
else
  echo "Skipping database migrations because SKIP_MIGRATIONS=1"
fi

wait_for_url "$FRONTEND_HEALTH_URL" "frontend" 240

echo "Container status:"
compose ps

echo "Recent logs:"
compose logs --tail=20

echo "Deployment complete."
echo "Frontend URL: http://localhost:9007"
echo "Backend URL:  http://localhost:5004"
echo "Follow logs:  docker compose -f docker-compose.production.yml logs -f"
