#!/bin/sh
# Post-deployment check — run on the CT, from /opt/clipvault.
# Verifies what has already broken once: code actually shipped in the image,
# session cookie issued, media mount, volume quota, hardening.
set -u

BASE=http://127.0.0.1:8099
echecs=0

ok() { printf '  ok    %s\n' "$1"; }
ko() { printf '  FAIL  %s\n' "$1"; echecs=$((echecs + 1)); }

check() {
  if [ "$2" = "1" ]; then ok "$1"; else ko "$1"; fi
}

printf '\n=== application ===\n'
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/login")
check "login page answers 200 (got $code)" "$([ "$code" = "200" ] && echo 1 || echo 0)"

cookie_avec=$(curl -s -D - -o /dev/null -H 'Host: clip.lanro.eu' -H 'X-Forwarded-Proto: https' -H 'X-Forwarded-For: 203.0.113.7' "$BASE/auth/start?next=%2F" | grep -ci '^set-cookie')
check "session cookie issued behind the proxy" "$([ "$cookie_avec" -ge 1 ] && echo 1 || echo 0)"
cookie_sans=$(curl -s -D - -o /dev/null -H 'Host: clip.lanro.eu' "$BASE/auth/start?next=%2F" | grep -ci '^set-cookie')
check "no insecure cookie without X-Forwarded-Proto" "$([ "$cookie_sans" -eq 0 ] && echo 1 || echo 0)"

printf '\n=== image and code ===\n'
attendu=$(grep -c 'function trustProxy' /opt/clipvault/src/config.ts 2>/dev/null || echo 0)
embarque=$(docker exec clipvault grep -c 'function trustProxy' /app/src/config.ts 2>/dev/null || echo 0)
check "the image embeds the repository code (source=$attendu, image=$embarque)" "$([ "$attendu" = "$embarque" ] && [ "$embarque" -ge 1 ] && echo 1 || echo 0)"

printf '\n=== storage ===\n'
media=$(docker exec clipvault sh -c 'ls /media 2>/dev/null | wc -l' | tr -d ' ')
check "media visible in the container ($media files)" "$([ "$media" -ge 1 ] && echo 1 || echo 0)"
libre=$(docker exec clipvault sh -c "df -P /media | awk 'NR==2 {print \$4}'" | tr -d ' ')
gros=$(df -P /srv/fireshare | awk 'NR==2 {print $2}')
check "the quota volume is mounted on /media (${gros} KB in total)" "$([ "$libre" -gt 1000000 ] && echo 1 || echo 0)"

printf '\n=== hardening ===\n'
mem=$(docker inspect clipvault --format '{{.HostConfig.Memory}}')
ro=$(docker inspect clipvault --format '{{.HostConfig.ReadonlyRootfs}}')
caps=$(docker inspect clipvault --format '{{.HostConfig.CapDrop}}')
check "memory limit set ($mem bytes)" "$([ "$mem" -gt 0 ] && echo 1 || echo 0)"
check "root filesystem read-only" "$([ "$ro" = "true" ] && echo 1 || echo 0)"
check "capabilities dropped ($caps)" "$(echo "$caps" | grep -q ALL && echo 1 || echo 0)"

printf '\n'
if [ "$echecs" -eq 0 ]; then
  echo "All green."
  exit 0
fi
echo "$echecs check(s) failed."
exit 1
