#!/usr/bin/env bash
# LEGACY — tunnel inverse depuis un hôte de dev vers un hub VPS.
# L'accès distant de ce déploiement passe désormais par le WAF (voir README,
# section « Déploiement ») : ce script n'est plus nécessaire.
# Tunnel inverse hôte-de-dev -> hub VPS, qui rendait l'app accessible depuis un
# second site via un DNAT déjà persisté.
#
#   navigateur distant -> 192.0.2.20:8099
#     -> DNAT vmbr0:8099 -> 10.0.0.1:8099 (MASQUERADE vers wg0)
#       -> hub VPS (écoute WireGuard uniquement)
#         -> ce tunnel -> 127.0.0.1:8099
#
# Usage : ./scripts/clipvault-tunnel.sh          (boucle de relance)
#         tmux new -d -s clipvault-tunnel ./scripts/clipvault-tunnel.sh
set -uo pipefail

KEY="${CLIPVAULT_TUNNEL_KEY:-$HOME/.ssh/id_ed25519}"
HUB="${CLIPVAULT_TUNNEL_HUB:-root@192.0.2.53}"
REMOTE="${CLIPVAULT_TUNNEL_REMOTE:-10.0.0.1:8099}"
LOCAL="${CLIPVAULT_TUNNEL_LOCAL:-127.0.0.1:8099}"

[ -f "$KEY" ] || { echo "clé absente : $KEY" >&2; exit 1; }

while :; do
  echo "$(date -Is) tunnel ${REMOTE} <- ${LOCAL} via ${HUB}"
  ssh -N -T \
    -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -o StrictHostKeyChecking=accept-new \
    -o IdentitiesOnly=yes \
    -i "$KEY" \
    -R "${REMOTE}:${LOCAL}" "$HUB"
  echo "$(date -Is) tunnel tombé, relance dans 5 s" >&2
  sleep 5
done
