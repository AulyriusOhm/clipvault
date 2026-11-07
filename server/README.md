# ClipVault — serveur

Remplaçant auto-hébergé de FireShare : dépôt et partage de clips de jeux vidéo.
Node 22 + TypeScript + Fastify + SQLite (`better-sqlite3`) + EJS rendu serveur,
métadonnées et miniatures via `ffprobe`/`ffmpeg`.

Le design de référence (7 écrans, 5 thèmes) est dans `../design/`.

## Démarrer

```bash
npm install
npm run db:seed        # base de démonstration : 5 comptes, 14 clips
npm start              # http://localhost:8099
```

En développement : `npm run dev` (rechargement à chaud).
`npm run build` fait un `tsc --noEmit` complet.

## Configuration

Tout passe par des variables d'environnement (voir `.env.example`).

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `PORT` / `HOST` | `8099` / `0.0.0.0` | écoute |
| `INSTANCE_NAME` | `La Tanière` | nom affiché |
| `AUTH_MODE` | `dev` | `dev` (bouton local) ou `oidc` (Authentik) |
| `SESSION_SECRET` | généré | ≥ 32 caractères ; sinon écrit dans `data/.session-secret` |
| `MAX_UPLOAD_GB` | `4` | taille maximale d'un dépôt |
| `OIDC_*` | — | obligatoires si `AUTH_MODE=oidc` ; `OIDC_REDIRECT_URI` facultatif (déduit de l'en-tête `Host` si absent) |

## Authentik (SSO)

Le provider OIDC et l'application `ClipVault` existent dans Authentik
(`auth.lanro.eu`, provider `ClipVault`, application slug `clipvault`), avec
`clipvault-admins` comme groupe administrateur.

- `AUTH_MODE=oidc` : l'app fait sa propre découverte OIDC, PKCE S256, `state` et
  `nonce`, échange le code avec `client_secret_basic`, lit `userinfo`.
- Le rôle vient du groupe : membre de `clipvault-admins` → `admin`, sinon `member`.
  Il est réévalué à chaque connexion.
- URI de retour enregistrées : `http://192.168.5.100:8099/auth/callback` et
  `http://127.0.0.1:8099/auth/callback`.

Vérification automatisée de bout en bout (crée un compte de test en amont) :

```bash
python3 scripts/oidc-login-check.py --verbose
```

## Administration

`/admin`, réservé au rôle `admin` : nom d'instance, **thème de l'instance**,
visibilité par défaut des dépôts, expiration des liens publics, taille maximale,
mode « sur invitation », liste des membres avec promotion/rétrogradation, et
jetons d'invitation.

### Thème

Le thème est un réglage **d'instance**, pas une préférence par utilisateur : il
est choisi dans `/admin`, stocké en base (`settings.theme`) et rendu par le
serveur dans `<html data-theme>` et `<meta name="theme-color">`. Il n'y a plus
de sélecteur dans l'interface, ni de `localStorage` : cinq thèmes disponibles
(Ember, Tide, Moss, Aurora, Paper) qui s'appliquent aussi à la page de connexion
et aux liens partagés.
Un jeton s'utilise une fois via `/join/<jeton>`, qui ouvre la connexion SSO ;
le compte est créé au premier login si `invite_only` est actif.

## Routes

| Route | Accès |
| --- | --- |
| `GET /library` | public (clips visibles selon la session) |
| `GET /watch/:slug` | selon visibilité du clip |
| `GET /c/:slug` | lien public, sans compte |
| `GET /upload` | connecté |
| `POST /upload` | connecté, `multipart/form-data` |
| `GET /media/:slug/video` | `Range` supporté, 206 |
| `GET /media/:slug/thumb` | JPEG |
| `POST /clips/:slug/delete` | auteur ou admin |
| `GET /login`, `GET /auth/start`, `GET /auth/callback`, `POST /auth/logout` | — |
| `GET /api/jobs` | JSON, file d'attente |
| `GET /admin` | admin |
| `POST /admin/settings`, `POST /admin/invites`, `POST /admin/invites/:id/revoke`, `POST /admin/members/:id/role` | admin |
| `GET /join/:token` | public (jeton à usage unique) |

## Visibilité

- `public` — listé et lisible par tout le monde
- `members` — réservé aux comptes connectés
- `link` — non listé, lisible par quiconque a l'URL (`/c/:slug`)

## Données

Tout est dans `data/` (ignoré par git) : `clipvault.db`, `media/`, `.session-secret`.
Sauvegarde = copier ce dossier.

## Déploiement : CT GammaClips (production)

L'instance publique tourne sur le CT 143 `GammaClips` de NASa, à la place de
FireShare, sur le domaine **https://clip.lanro.eu**.

| Élément | Valeur |
| --- | --- |
| Code | `/opt/clipvault` |
| Conteneur | `clipvault` (image `clipvault:latest`, policy `unless-stopped`) |
| Port | `8099`, atteint par le WAF ; le CT n'est **pas** exposé directement |
| Données | `/opt/clipvault/data` (`clipvault.db`, `.session-secret`) |
| Médias | `/srv/fireshare/clipvault/media` monté sur `/media` (`MEDIA_DIR=/media`) |
| Quota du volume | **150 Go** (`refquota` ZFS de `HDD_POOL/subvol-143-disk-0`) |
| Entrée publique | `clip.lanro.eu` → WAF BunkerWeb (`194.164.201.13`) → `192.168.1.243:8099` |
| Certificat | wildcard `*.lanro.eu` (Let's Encrypt), terminé par le WAF |
| Authentification | Authentik OIDC (`https://auth.lanro.eu/application/o/clipvault/`), groupe admin `clipvault-admins` |
| Accès LAN | `http://192.168.1.243:8099` depuis le site SLP ; `http://192.168.5.100:8099` par DNAT depuis Grenoble |

Derrière un proxy qui termine le TLS, trois variables sont obligatoires :
`BASE_URL=https://clip.lanro.eu`, `TRUST_PROXY=true` (IP réelle des clients dans
les journaux et la limitation de débit) et `COOKIE_SECURE=true`.

### Mise à jour

```bash
# depuis le poste de dev
tar -czf /tmp/clipvault-src.tar.gz --exclude=node_modules --exclude=data --exclude=.env .
scp /tmp/clipvault-src.tar.gz root@192.168.1.243:/root/
ssh root@192.168.1.243 'cd /opt/clipvault && tar -xzf /root/clipvault-src.tar.gz --strip-components=1 && docker compose up -d --build'
```

### Stockage et quota

Les vidéos vivent sur le volume du CT, pas sur le disque système (24 Go). Le
quota est un `refquota` ZFS, posé côté hôte :

```bash
pct set 143 -mp0 HDD_POOL:subvol-143-disk-0,mp=/srv/fireshare,size=150G
zfs set refquota=150G HDD_POOL/subvol-143-disk-0   # pct set ne touche pas au refquota
```

`/admin` affiche l'espace libre réel du volume. Le dépôt est refusé avec un
message explicite quand l'espace libre tombe sous `MAX_UPLOAD_GB`, pour éviter
un `ENOSPC` en cours d'écriture.

### Import des vidéos existantes

`src/import.ts` parcourt un dossier, sonde chaque fichier avec `ffprobe`,
extrait une miniature, devine le jeu d'après le nom et crée un **lien
symbolique** vers la source. Sur ce déploiement les neuf clips importés ont été
remplacés par de vraies copies dans le volume (les liens pointaient vers le
montage `/media-src` de FireShare, supprimé depuis) ; vérifiées identiques à
l'octet près par `cmp` avant bascule.

```bash
docker compose exec -T clipvault npx tsx src/import.ts /media <membre>
```

### Ancien FireShare

Retiré le 07/11/2026 : conteneurs `fireshare`, `fireshare-caddy` et `wud`
supprimés, `/opt/fireshare` archivé dans `/root/fireshare-config-*.tar.gz`,
application et provider proxy retirés d'Authentik. Les fichiers d'origine
restent dans `/srv/fireshare/videos/uploads` (5 Go, doublons des copies
vérifiées) : les supprimer rend 5 Go quand on le souhaite.

### Limites connues sur ce déploiement

- un seul fichier source par clip, pas de transcodage : le clip de 71 min / 4,3 Go
  est servi tel quel (lecture par `Range`, donc pas de téléchargement complet)
- les titres importés viennent des noms de fichiers (`IMG 1090`,
  `2025.08.27 — 23.14`) : il n'existe pas encore d'édition de métadonnées
- pas de sauvegarde automatisée de `clipvault.db` (le CT n'est pas dans un job
  PBS pour l'instant)

## Sécurité

Mesures en place : `@fastify/static` à jour (CVE de traversée de chemin corrigée),
en-têtes CSP / nosniff / X-Frame-Options / Referrer-Policy / Permissions-Policy,
limitation de débit sur connexion, dépôt et invitations, `/api/jobs` et
téléchargement réservés aux membres, redirections `next` validées en liste
blanche, propriété des clips comparée par identifiant, sessions régénérées à la
connexion, filtre de visibilité appliqué aux compteurs, ffmpeg borné en temps et
restreint aux protocoles locaux, conteneur non privilégié sans capacités.

### Avant une exposition sur Internet

1. **TLS obligatoire.** Terminer TLS sur un proxy inverse, puis :
   `COOKIE_SECURE=true`, `TRUST_PROXY=true`, et renseigner `public_url` dans
   `/admin` avec l'URL `https://`. Sans cela le cookie de session — 30 jours,
   valable pour l'admin — circule en clair.
2. **Ne pas publier le port 8099** au-delà du proxy : le conteneur doit être
   joignable seulement depuis le réseau du proxy.
3. `AUTH_MODE=dev` est refusé dès que `NODE_ENV=production` ; vérifier que
   `OIDC_*` est bien renseigné avant de basculer.
4. Sauvegarder `/opt/clipvault/data` (base + médias + secret de session).
5. Restent ouverts, à trancher selon l'exposition : pas de jeton CSRF (compensé
   par `sameSite=lax`), sessions en mémoire, limitation de débit par processus,
   pas de quota par membre, et ffmpeg qui traite des fichiers fournis par les
   membres (à isoler dans un conteneur dédié si l'exposition est large).

## Reste à faire

- Transcodage (aujourd'hui : un seul fichier source + miniature)
- Purge automatique des `link` expirés et des fichiers orphelins
- Profil joueur et page « mes clips »
- Tests automatisés du parcours d'upload
