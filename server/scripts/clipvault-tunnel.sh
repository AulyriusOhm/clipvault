#!/usr/bin/env bash
# LEGACY — reverse tunnel from a dev host to a VPS hub.
# Remote access for this deployment now goes through the WAF (see README,
# "Deployment" section): this script is no longer needed.
# Dev-host -> VPS hub reverse tunnel, which made the app reachable from a
# second site through an already persisted DNAT.
#
#   remote browser -> 192.0.2.20:8099
#     -> DNAT vmbr0:8099 -> 10.0.0.1:8099 (MASQUERADE to wg0)
#       -> VPS hub (listens on WireGuard only)
#         -> this tunnel -> 127.0.0.1:8099
#
# Usage: ./scripts/clipvault-tunnel.sh          (restart loop)
#         tmux new -d -s clipvault-tunnel ./scripts/clipvault-tunnel.sh
set -uo pipefail

KEY="${CLIPVAULT_TUNNEL_KEY:-$HOME/.ssh/id_ed25519}"
HUB="${CLIPVAULT_TUNNEL_HUB:-root@192.0.2.53}"
REMOTE="${CLIPVAULT_TUNNEL_REMOTE:-10.0.0.1:8099}"
LOCAL="${CLIPVAULT_TUNNEL_LOCAL:-127.0.0.1:8099}"

[ -f "$KEY" ] || { echo "missing key: $KEY" >&2; exit 1; }

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
  echo "$(date -Is) tunnel down, restarting in 5 s" >&2
  sleep 5
done
