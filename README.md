# ClipVault

Hébergement et partage de clips de jeux vidéo, auto-hébergé. Un remplaçant de
[Fireshare](https://github.com/ShaneIsrael/fireshare) pensé pour un petit groupe
de joueurs (5 à 50 comptes) : on dépose un clip, il est lisible dans le
navigateur, partageable par lien.

- **SSO** par OIDC (Authentik, Keycloak, …), avec un rôle `admin` issu d'un
  groupe ; mode `dev` pour essayer sans fournisseur d'identité.
- **Visibilité par clip** : `public`, `members` (comptes connectés), `link`
  (non listé, lisible par quiconque a l'URL).
- **Lecture directe** du fichier d'origine (`Range`, 206) : pas de transcodage,
  un clip de 4 Go se lit sans être téléchargé en entier.
- **Métadonnées techniques** extraites à la volée par `ffprobe` (résolution, fps,
  codec, taille, durée) et miniature par `ffmpeg`.
- **Cinq thèmes** choisis par l'instance depuis `/admin` : Ember, Tide, Moss,
  Aurora, Paper.
- **Tags**, recherche, tri, pagination, invitations à usage unique, compteur de
  vues, expiration des liens publics.
- **Une seule dépendance de service** : SQLite. Sauvegarde = copier `data/`.

## Pile

Node 22 · TypeScript · Fastify 5 · EJS rendu serveur · SQLite
(`better-sqlite3`) · `ffmpeg`/`ffprobe` · CSS écrit à la main, sans framework
ni étape de build front.

## Démarrage

```bash
cd server
npm install
npm run db:seed        # base de démonstration : 5 comptes, 14 clips
npm start              # http://localhost:8099
```

En développement : `npm run dev` (rechargement à chaud), `npm run build` fait un
`tsc --noEmit` complet.

Configuration par variables d'environnement — voir [`server/.env.example`](server/.env.example)
et [`server/README.md`](server/README.md) pour le détail (proxy TLS,
`TRUST_PROXY`, OIDC, quota, import de vidéos existantes, contrôle après
déploiement).

## Design

Le design de référence (7 écrans, 5 thèmes) est dans [`design/`](design/) :
ouvrir `design/index.html` dans un navigateur. [`mockups/`](mockups/) garde les
trois variantes comparées à l'aveugle avant de retenir « Vault Ledger ».

## Sécurité

Le modèle est documenté dans [`server/README.md`](server/README.md) : `SameSite`
+ contrôle d'`Origin` au lieu de jetons CSRF, `TRUST_PROXY` en nombre de proxys
(jamais `true`), `COOKIE_SECURE` derrière un proxy terminant le TLS, conteneur
durci (racine en lecture seule, capabilities retirées, `ffmpeg` borné).
Signalement de vulnérabilité : voir [`SECURITY.md`](SECURITY.md).

## Licence

[MIT](LICENSE).
