#!/usr/bin/env bash
# LEGACY — sert uniquement l'ancien déploiement sur plasmasrv (hub VPS -> 10.1.50.10).
# Depuis la bascule sur le CT GammaClips, l'accès LAN passe par un DNAT sur gammaWTR
# vers 192.168.1.243:8099 et ce script n'est plus nécessaire. Voir README, section
# « Déploiement : CT GammaClips ».
# Tunnel inverse plasmasrv -> hub VPS, qui rend l'app accessible depuis le LAN
# Grenoble via http://192.168.5.100:8099 (DNAT sur gammaWTR, déjà persisté).
#
#   navigateur LAN -> 192.168.5.100:8099
#     -> DNAT vmbr0:8099 -> 10.10.10.1:8099 (MASQUERADE vers wg0)
#       -> hub VPS (écoute WireGuard uniquement)
#         -> ce tunnel -> 127.0.0.1:8099
#
# Usage : ./scripts/clipvault-tunnel.sh          (boucle de relance)
#         tmux new -d -s clipvault-tunnel ./scripts/clipvault-tunnel.sh
set -uo pipefail

KEY="${CLIPVAULT_TUNNEL_KEY:-$HOME/.ssh/id_ed25519_ohm}"
HUB="${CLIPVAULT_TUNNEL_HUB:-root@194.164.201.13}"
REMOTE="${CLIPVAULT_TUNNEL_REMOTE:-10.10.10.1:8099}"
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
