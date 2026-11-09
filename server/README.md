# ClipVault — server

Self-hosted replacement for FireShare: hosting and sharing for game clips.
Node 22 + TypeScript + Fastify + SQLite (`better-sqlite3`) + server-rendered
EJS, metadata and thumbnails through `ffprobe`/`ffmpeg`.

The reference design (7 screens, 5 themes) lives in `../design/`.

## Getting started

```bash
npm install
npm run db:seed        # demo database: 5 accounts, 14 clips
npm start              # http://localhost:8099
```

For development: `npm run dev` (hot reload).
`npm run build` runs a full `tsc --noEmit`.

## Configuration

Everything goes through environment variables (see `.env.example`).

| Variable | Default | Role |
| --- | --- | --- |
| `PORT` / `HOST` | `8099` / `0.0.0.0` | listen address |
| `INSTANCE_NAME` | `La Tanière` | displayed name |
| `AUTH_MODE` | `dev` | `dev` (local button) or `oidc` (Authentik) |
| `SESSION_SECRET` | generated | ≥ 32 characters; otherwise written to `data/.session-secret` |
| `MAX_UPLOAD_GB` | `4` | maximum size of a single upload |
| `OIDC_*` | — | required when `AUTH_MODE=oidc`; `OIDC_REDIRECT_URI` optional (derived from the `Host` header when absent) |

## Authentik (SSO)

The OIDC provider and the `ClipVault` application live in Authentik
(`auth.lanro.eu`, provider `ClipVault`, application slug `clipvault`), with
`clipvault-admins` as the administrator group.

- `AUTH_MODE=oidc`: the app does its own OIDC discovery, PKCE S256, `state` and
  `nonce`, exchanges the code with `client_secret_basic`, reads `userinfo`.
- The role comes from the group: member of `clipvault-admins` → `admin`,
  otherwise `member`. It is re-evaluated on every sign-in.
- Registered redirect URIs: `https://clip.lanro.eu/auth/callback` (and
  `http://127.0.0.1:8099/auth/callback` for local trials). **The first URI in
  the list becomes the launch URL of the tile in Authentik**: if an internal
  address sits at the top, the SSO interface sends the browser to that IP. The
  application also pins `meta_launch_url` to `https://clip.lanro.eu`.
- A sign-in started on any address other than the public URL (a LAN IP over
  `http`) is redirected to the domain by `/auth/start`: the `Secure` cookie
  would not be set there and the session would be lost on the way back from
  Authentik.

End-to-end automated check: the script walks Authentik's authentication flow
without a browser, posts the code to `/auth/callback` and checks that the
session is opened. It needs a test account **with a password, created by hand
for the duration of the check and then deleted**: no test account is kept on
the IdP.

```bash
CLIPVAULT_TEST_PASSWORD=… python3 scripts/oidc-login-check.py --verbose
# CLIPVAULT_TEST_USER (default clipvault-test), CLIPVAULT_APP, CLIPVAULT_ISSUER
```

## Administration

`/admin`, restricted to the `admin` role: instance name, **instance theme**,
default visibility for uploads, public link expiry, maximum size,
"invite only" mode, member list with promotion/demotion, and invite tokens.

### Theme

The theme is an **instance** setting, not a per-user preference: it is chosen
in `/admin`, stored in the database (`settings.theme`) and rendered by the
server in `<html data-theme>` and `<meta name="theme-color">`. There is no
longer a selector in the interface, nor any `localStorage`: five themes
(Ember, Tide, Moss, Aurora, Paper) that also apply to the login page and to
shared links.

### Invites

A token is used once through `/join/<token>`, which opens the SSO sign-in; the
account is created on first login when `invite_only` is active.

## Routes

| Route | Access |
| --- | --- |
| `GET /library` | public (clips visible according to the session) |
| `GET /watch/:slug` | according to the clip's visibility |
| `GET /c/:slug` | public link, no account |
| `GET /upload` | signed in |
| `POST /upload` | signed in, `multipart/form-data` |
| `GET /media/:slug/video` | `Range` supported, 206 |
| `GET /media/:slug/thumb` | JPEG |
| `POST /clips/:slug/delete` | author or admin |
| `GET /login`, `GET /auth/start`, `GET /auth/callback`, `POST /auth/logout` | — |
| `GET /api/jobs` | JSON, upload queue |
| `GET /admin` | admin |
| `POST /admin/settings`, `POST /admin/invites`, `POST /admin/invites/:id/revoke`, `POST /admin/members/:id/role` | admin |
| `GET /join/:token` | public (single-use token) |

## Visibility

- `public` — listed and readable by anyone
- `members` — restricted to signed-in accounts
- `link` — unlisted, readable by anyone with the URL (`/c/:slug`)

## Data

Everything lives in `data/` (ignored by git): `clipvault.db`, `media/`,
`.session-secret`. Backup = copy that folder.

## Deployment (production)

The public instance runs in a Proxmox LXC container, in place of FireShare, on
the domain **https://clip.lanro.eu**. Addresses below are placeholders
(`192.0.2.0/24` = RFC 5737 documentation range).

| Item | Value |
| --- | --- |
| Code | `/opt/clipvault` |
| Container | `clipvault` (image `clipvault:latest`, policy `unless-stopped`) |
| Port | `8099`, reached through the WAF; the container is **not** exposed directly |
| Data | `/opt/clipvault/data` (`clipvault.db`, `.session-secret`) |
| Media | `/srv/fireshare/clipvault/media` mounted on `/media` (`MEDIA_DIR=/media`) |
| Volume quota | **150 GB** (ZFS `refquota` of `POOL/subvol-<vmid>-disk-0`) |
| Public entry point | `clip.lanro.eu` → BunkerWeb WAF → `192.0.2.10:8099` |
| Certificate | wildcard `*.lanro.eu` (Let's Encrypt), terminated by the WAF |
| Authentication | Authentik OIDC (`https://auth.lanro.eu/application/o/clipvault/`), admin group `clipvault-admins` |
| LAN access | `http://192.0.2.10:8099` on the local network, or through a redirect from another site |

Behind a TLS-terminating proxy, three variables are mandatory:
`BASE_URL=https://clip.lanro.eu`, `COOKIE_SECURE=true`, and `TRUST_PROXY=1`
(number of trusted proxies — see below).

### TRUST_PROXY: a number, never `true`

`TRUST_PROXY=true` trusts the whole `X-Forwarded-For` chain, and therefore
whatever value the client put in it: rate limiting becomes bypassable (a
different `X-Forwarded-For` per request is enough). `TRUST_PROXY=1` only keeps
the last hop, the one added by the WAF, and ignores the rest.

Careful: `@fastify/session` emits **no** cookie when `COOKIE_SECURE=true` and
the request is not recognised as HTTPS. Without `X-Forwarded-Proto` on the
proxy side (or with `TRUST_PROXY` misread), the sign-in fails with "invalid
OIDC state" on the way back from Authentik — the symptom looks harmless, the
cause is right there.

### Container hardening

Read-only root (`/tmp` on tmpfs), `mem_limit 2g`, `pids_limit 256`, every
capability dropped, `no-new-privileges`, logs capped at 3 × 10 MB, process
running as uid 1000. `ffmpeg` processes files supplied by members: these
limits are what stops a crafted file or a burst of uploads from bringing the
container to its knees.

### Post-deployment check

```bash
ssh root@192.0.2.10 'sh /opt/clipvault/scripts/verifier-deploiement.sh'
```

It checks what has already broken once: code actually baked into the image (a
`docker compose up` without `--build` keeps the old one), session cookie
emitted behind the proxy, volume mounted on `/media`, hardening in effect.
**Rebuild with `--no-cache` when a source file changes** and run this script
again.

### Updating

```bash
# from the dev machine
cd server
tar -czf /tmp/clipvault-src.tar.gz --exclude=node_modules --exclude=data --exclude=.env .
scp /tmp/clipvault-src.tar.gz root@192.0.2.10:/root/
ssh root@192.0.2.10 'cd /opt/clipvault && tar -xzf /root/clipvault-src.tar.gz --strip-components=1 && docker compose up -d --build'
```

### Storage and quota

Videos live on the container's volume, not on the system disk (24 GB). The
quota is a ZFS `refquota`, set on the host:

```bash
pct set <vmid> -mp0 POOL:subvol-<vmid>-disk-0,mp=/srv/fireshare,size=150G
zfs set refquota=150G POOL/subvol-<vmid>-disk-0   # pct set does not touch refquota
```

`/admin` shows the real free space of the volume. An upload is refused with an
explicit message when free space drops below `MAX_UPLOAD_GB`, to avoid an
`ENOSPC` in the middle of a write.

### Importing existing videos

`src/import.ts` walks a folder, probes each file with `ffprobe`, extracts a
thumbnail, guesses the game from the filename and creates a **symlink** to the
source. On this deployment the nine imported clips were replaced by real copies
on the volume (the links pointed at FireShare's `/media-src` mount, removed
since); verified byte-identical with `cmp` before switching over.

```bash
docker compose exec -T clipvault npx tsx src/import.ts /media <member>
```

### Former FireShare

Removed on 2026-11-07: the `fireshare`, `fireshare-caddy` and `wud` containers
were deleted, `/opt/fireshare` archived to `/root/fireshare-config-*.tar.gz`,
the application and proxy provider removed from Authentik. The original files
remain in `/srv/fireshare/videos/uploads` (5 GB, duplicates of the verified
copies): deleting them frees 5 GB whenever you like.

### Known limits of this deployment

- one source file per clip, no transcoding: the 71 min / 4.3 GB clip is served
  as is (playback through `Range`, so no full download)
- imported titles come from filenames (`IMG 1090`, `2025.08.27 — 23.14`): there
  is no metadata editing yet
- no automated backup of `clipvault.db` (the container is not in a PBS job yet)

## CSRF: what protects you, and what does not

Two layers, verified by experiment on 2026-11-07 (hostile page served from
another origin, auto-submitted form to `/admin/invites`):

| Origin of the hostile page | Cookie sent | Effect |
| --- | --- | --- |
| `attacker.example` | no (`SameSite=Lax`) | none |
| `other.lanro.eu` | **yes** (same site) | write accepted before the fix |

`SameSite` reasons on the **site** (eTLD+1), so every subdomain of `lanro.eu`
is trusted. An `onRequest` hook now rejects any writing method when the
`Origin` header does not match the host of `public_url` / `BASE_URL` — about
ten lines, no token, no form to modify.

Without an `Origin` header (clients that do not send one), the request goes
through: `SameSite` covers that case. Do not replace this check with CSRF
tokens: they would not prevent the "same site" scenario above and would force
changes to all nine forms, the multipart upload included.

The only `GET` routes that write are `/watch/:slug` and `/c/:slug` (view
counter, through `incrementViews`) and `/join/:token` (stores the invite token
in the session, consumed only when an account is created while `invite_only` is
active). No destructive action goes through a `GET`.

## Security

Measures in place: `@fastify/static` up to date (path traversal CVE fixed),
CSP / nosniff / X-Frame-Options / Referrer-Policy / Permissions-Policy headers,
rate limiting on sign-in, upload and invites, `/api/jobs` and downloads
restricted to members, `next` redirects validated against an allow-list, clip
ownership compared by identifier, sessions regenerated on sign-in, visibility
filter applied to counters, `ffmpeg` time-boxed and restricted to local
protocols, unprivileged container without capabilities.

### Before exposing it to the Internet

1. **TLS is mandatory.** Terminate TLS on a reverse proxy, then:
   `COOKIE_SECURE=true`, `TRUST_PROXY=1`, and set `public_url` in `/admin` to
   the `https://` URL. Without that, the session cookie — 30 days, valid for
   the admin — travels in clear text.
2. **Do not publish port 8099** beyond the proxy: the container must only be
   reachable from the proxy's network.
3. `AUTH_MODE=dev` is refused as soon as `NODE_ENV=production`; check that
   `OIDC_*` is filled in before switching.
4. Back up `/opt/clipvault/data` (database + media + session secret).
5. Still open, to be decided according to exposure: no CSRF token (offset by
   `sameSite=lax`), in-memory sessions, per-process rate limiting, no
   per-member quota, and `ffmpeg` processing member-supplied files (isolate it
   in a dedicated container if exposure grows).

## To do

- Transcoding (today: a single source file + thumbnail)
- Automatic purge of expired `link` clips and orphaned files
- Player profile and a "my clips" page
- Automated tests for the upload flow
