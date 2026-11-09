# Sécurité

ClipVault est un service auto-hébergé : il n'y a pas d'instance publique
maintenue par le projet, et aucune version n'est supportée au sens d'un
engagement de correctif. Le code est fourni tel quel (voir `LICENSE`).

## Signaler une vulnérabilité

Utilise **GitHub → Security → Report a vulnerability** (avis privé) plutôt
qu'une issue publique : le rapport reste visible des seuls mainteneurs le temps
du correctif.

Merci de préciser : version ou commit, configuration (`AUTH_MODE`, présence d'un
proxy terminant le TLS), étapes de reproduction, et l'impact que tu estimes
(lecture d'un clip privé, contournement de la limitation de débit, exécution de
code via un fichier déposé, etc.).

## Périmètre

Sont particulièrement intéressants :

- contournement de la visibilité d'un clip (`public` / `members` / `link`) ou de
  la propriété (suppression d'un clip d'autrui) ;
- contournement de l'authentification OIDC ou du rôle `admin` ;
- traversée de chemin, `Range` mal géré ou lecture hors de `MEDIA_DIR` via
  `/media/:slug/*` ;
- injection de commande ou évasion du bac à sable autour de `ffprobe`/`ffmpeg`
  (fichier déposé piégé) ;
- contournement de la limitation de débit par `X-Forwarded-For` ;
- CSRF sur les routes qui écrivent.

## Hors périmètre

- absence de jeton CSRF par formulaire : le modèle est `SameSite=Lax` + contrôle
  d'`Origin`, documenté dans `server/README.md` ;
- sessions en mémoire (perdues au redémarrage) et absence de quota par membre :
  limites connues, listées dans le README ;
- déploiements qui exposent `AUTH_MODE=dev` ou le port `8099` sur Internet :
  erreur de configuration, pas une vulnérabilité du code.
