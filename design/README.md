# ClipVault — design de référence

Variante retenue après le test à l'aveugle : « Vault Ledger », durcie.

Ouvrir `index.html` (sommaire), ou directement `library.html` pour entrer dans le mockup.

## Écrans

| Fichier | Contenu |
| --- | --- |
| `index.html` | Sommaire : écrans, thèmes, corrections, points ouverts |
| `library.html` | Grille de clips, recherche, filtres, tri, pagination, état vide |
| `watch.html` | Player, métadonnées techniques, tags, historique du fichier |
| `upload.html` | Drop, file d'attente à 4 états, métadonnées, confirmation |
| `login.html` | SSO Authentik, erreur OIDC, lecture seule |
| `share.html` | Vue publique d'un lien partagé, sans compte |
| `404.html` | Clip supprimé + table des autres codes d'erreur |

## Thèmes

Ember, Tide, Moss, Aurora, Paper. Bascules par les pastilles du sélecteur ou
`Alt+1` à `Alt+5`, persistées dans `localStorage` (`clipvault.theme`).
`theme.js` est la source unique des couleurs : aucune valeur n'est dupliquée
dans le HTML.

## Corrections appliquées après sélection

Accessibilité — lien d'évitement, `prefers-reduced-motion`, `role="progressbar"`
sur les barres de téléversement, `aria-live` sur la file, `role="status"` sur la
confirmation, `role="alert"` sur l'erreur de connexion, `aria-current="page"`,
`aria-hidden` + `focusable="false"` sur les icônes décoratives, `tabindex` sur
les curseurs de lecture.

Code — pastilles de thème peintes depuis une table unique, `meta theme-color`
et `color-scheme` synchronisés, raccourcis clavier.

## Contraintes tenues

Aucun framework, aucun build, aucune requête réseau : polices système, icônes
SVG inline, miniatures en dégradés CSS. Chaque page s'ouvre seule depuis le
disque.

## Points ouverts

- Réglages d'instance, membres et invitations, profil joueur.
- Expiration par défaut d'un lien public, quota par membre, transcodage.
- Aucune vue mobile spécifiquement dessinée (le rail se replie sous 760 px).
