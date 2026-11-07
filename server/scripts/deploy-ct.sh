#!/usr/bin/env bash
# Déploiement de ClipVault sur le CT GammaClips (192.168.1.243).
# Le code source est attendu dans /root/clipvault-src.tar.gz (avec /app/.env à côté).
#
#   ./scripts/deploy-ct.sh              # construit, démarre, importe les vidéos existantes
#   SKIP_IMPORT=1 ./scripts/deploy-ct.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/clipvault}"
SRC="${SRC:-/root/clipvault-src.tar.gz}"
MEDIA_SRC="${MEDIA_SRC:-/srv/fireshare/videos/uploads}"
IMPORT_AS="${IMPORT_AS:-kael_}"
PORT="${PORT:-8099}"

echo "== extraction vers $APP_DIR"
install -d -m 755 "$APP_DIR"
tar -xzf "$SRC" -C "$APP_DIR" --strip-components=1

cd "$APP_DIR"
[ -f .env ] || { echo "fichier .env absent dans $APP_DIR — abandon"; exit 1; }

echo "== construction de l'image"
docker compose build

echo "== démarrage"
docker compose up -d

echo "== attente de l'application"
for _ in $(seq 1 40); do
  if curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/library"; then
    echo "   app prête"
    break
  fi
  sleep 2
done

echo "== comptes (sans clips de démonstration)"
docker compose exec -T clipvault npx tsx src/seed.ts --users-only

if [ "${SKIP_IMPORT:-0}" != "1" ]; then
  echo "== import des vidéos de $MEDIA_SRC"
  docker compose exec -T clipvault npx tsx src/import.ts /media-src "$IMPORT_AS" || true
fi

echo "== état"
curl -s -o /dev/null -w "   /library : %{http_code}\n" "http://127.0.0.1:${PORT}/library"
docker compose ps
