#!/usr/bin/env bash
# Deploying ClipVault on a dedicated Proxmox CT (192.0.2.10).
# The source archive is expected at /root/clipvault-src.tar.gz (with /app/.env next to it).
#
#   ./scripts/deploy-ct.sh              # build, start, import existing videos
#   SKIP_IMPORT=1 ./scripts/deploy-ct.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/clipvault}"
SRC="${SRC:-/root/clipvault-src.tar.gz}"
MEDIA_SRC="${MEDIA_SRC:-/srv/fireshare/videos/uploads}"
IMPORT_AS="${IMPORT_AS:-kael_}"
PORT="${PORT:-8099}"

echo "== extracting to $APP_DIR"
install -d -m 755 "$APP_DIR"
tar -xzf "$SRC" -C "$APP_DIR" --strip-components=1

cd "$APP_DIR"
[ -f .env ] || { echo "missing .env file in $APP_DIR — aborting"; exit 1; }

echo "== building the image"
docker compose build

echo "== starting"
docker compose up -d

echo "== waiting for the application"
for _ in $(seq 1 40); do
  if curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/library"; then
    echo "   app ready"
    break
  fi
  sleep 2
done

echo "== accounts (no demo clips)"
docker compose exec -T clipvault npx tsx src/seed.ts --users-only

if [ "${SKIP_IMPORT:-0}" != "1" ]; then
  echo "== importing videos from $MEDIA_SRC"
  docker compose exec -T clipvault npx tsx src/import.ts /media-src "$IMPORT_AS" || true
fi

echo "== status"
curl -s -o /dev/null -w "   /library : %{http_code}\n" "http://127.0.0.1:${PORT}/library"
docker compose ps
