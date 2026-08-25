#!/usr/bin/env bash
# Production deploy script — run on the Lightsail server.
# Pulls the latest main, rebuilds changed images, and restarts containers.
# Invoked automatically by .github/workflows/deploy.yml, or manually via:
#   bash ~/creatorai/scripts/deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/creatorai}"
COMPOSE_FILE="docker-compose.prod.yml"

cd "$APP_DIR"

echo "==> Fetching latest code"
git fetch --all --prune
git reset --hard origin/main

echo "==> Building images (only changed layers rebuild)"
docker compose -f "$COMPOSE_FILE" build

echo "==> Restarting containers"
docker compose -f "$COMPOSE_FILE" up -d

echo "==> Reloading Caddy config"
# The Caddyfile is bind-mounted, so `up -d` leaves the running container with
# the old config in memory. Reload picks up edits with no dropped connections,
# and refuses to apply a broken config rather than taking the site down.
docker compose -f "$COMPOSE_FILE" exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

echo "==> Cleaning up old images"
docker image prune -f

echo "==> Current status"
docker compose -f "$COMPOSE_FILE" ps

echo "==> Deploy complete"
