#!/bin/sh
# Contrôle après déploiement — à lancer sur le CT, depuis /opt/clipvault.
# Vérifie ce qui a déjà cassé une fois : code réellement embarqué dans l'image,
# cookie de session émis, montage des médias, quota du volume, durcissement.
set -u

BASE=http://127.0.0.1:8099
echecs=0

ok() { printf '  ok    %s\n' "$1"; }
ko() { printf '  ÉCHEC %s\n' "$1"; echecs=$((echecs + 1)); }

check() {
  if [ "$2" = "1" ]; then ok "$1"; else ko "$1"; fi
}

printf '\n=== application ===\n'
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/login")
check "page de connexion répond 200 (reçu $code)" "$([ "$code" = "200" ] && echo 1 || echo 0)"

cookie_avec=$(curl -s -D - -o /dev/null -H 'X-Forwarded-Proto: https' -H 'X-Forwarded-For: 203.0.113.7' "$BASE/auth/start?next=%2F" | grep -ci '^set-cookie')
check "cookie de session émis derrière le proxy" "$([ "$cookie_avec" -ge 1 ] && echo 1 || echo 0)"
cookie_sans=$(curl -s -D - -o /dev/null "$BASE/auth/start?next=%2F" | grep -ci '^set-cookie')
check "aucun cookie en clair sans X-Forwarded-Proto" "$([ "$cookie_sans" -eq 0 ] && echo 1 || echo 0)"

printf '\n=== image et code ===\n'
attendu=$(grep -c 'function trustProxy' /opt/clipvault/src/config.ts 2>/dev/null || echo 0)
embarque=$(docker exec clipvault grep -c 'function trustProxy' /app/src/config.ts 2>/dev/null || echo 0)
check "l'image embarque bien le code du dépôt (source=$attendu, image=$embarque)" "$([ "$attendu" = "$embarque" ] && [ "$embarque" -ge 1 ] && echo 1 || echo 0)"

printf '\n=== stockage ===\n'
media=$(docker exec clipvault sh -c 'ls /media 2>/dev/null | wc -l' | tr -d ' ')
check "médias visibles dans le conteneur ($media fichiers)" "$([ "$media" -ge 1 ] && echo 1 || echo 0)"
libre=$(docker exec clipvault sh -c "df -P /media | awk 'NR==2 {print \$4}'" | tr -d ' ')
gros=$(df -P /srv/fireshare | awk 'NR==2 {print $2}')
check "le volume du quota est bien monté sur /media (${gros} Ko au total)" "$([ "$libre" -gt 1000000 ] && echo 1 || echo 0)"

printf '\n=== durcissement ===\n'
mem=$(docker inspect clipvault --format '{{.HostConfig.Memory}}')
ro=$(docker inspect clipvault --format '{{.HostConfig.ReadonlyRootfs}}')
caps=$(docker inspect clipvault --format '{{.HostConfig.CapDrop}}')
check "limite mémoire posée ($mem octets)" "$([ "$mem" -gt 0 ] && echo 1 || echo 0)"
check "racine en lecture seule" "$([ "$ro" = "true" ] && echo 1 || echo 0)"
check "capabilities retirées ($caps)" "$(echo "$caps" | grep -q ALL && echo 1 || echo 0)"

printf '\n'
if [ "$echecs" -eq 0 ]; then
  echo "Tout est vert."
  exit 0
fi
echo "$echecs contrôle(s) en échec."
exit 1
