# BRIEF — ClipVault, design mockups (v0.1)

## Le produit

ClipVault est un remplaçant auto-hébergé de **Fireshare** : une plateforme d'hébergement et de
partage rapide de **clips de jeux vidéo**. Cible : un petit groupe de joueurs auto-hébergeurs
(5 à 50 utilisateurs) qui droppent leurs clips et les partagent par lien.

Ce que Fireshare fait mal et que ClipVault doit faire mieux :

1. **Pas de SSO.** ClipVault s'authentifie via **Authentik** (OIDC). L'écran de login est donc
   minimal : un bouton "Se connecter avec Authentik", le nom de l'instance, un état d'erreur
   propre. Pas de formulaire email/mot de passe (optionnel, mais pas la voie principale).
2. **Interface datée.** Fireshare ressemble à un Bootstrap 4 de 2016 : cartes lourdes, ombres
   partout, coins arrondis génériques, typographie par défaut. ClipVault doit être
   **minimaliste, calme, dense en information, et clairement dessiné** — pas un template.
3. **Thèmes.** L'utilisateur choisit parmi **5 thèmes**, persistés côté client :
   - **Ember** — noir profond + marron clair (accent chaud, sable/ambre)
   - **Tide** — noir profond + cyan (accent froid, technique)
   - **Moss** — vert + blanc (accent végétal, lumineux, faible saturation)
   - **Aurora** — blanc + violet (clair, accent violet, contraste doux)
   - **Paper** — gris + marron (neutre, papier, presque monochrome, accent brun)

## Périmètre des mockups

Des **mockups HTML statiques**, pas d'application. Pas de backend, pas de build, pas de framework.
Chaque écran est un fichier `.html` autonome qui partage un CSS et un JS de thème.

Écrans à produire (4 fichiers HTML par variante) :

| Fichier          | Contenu attendu                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| `library.html`   | Écran principal : grille des clips, recherche, filtres (jeu, tag, date, durée), tri, état vide, pagination |
| `watch.html`     | Lecture d'un clip : player 16:9, métadonnées (jeu, joueur, date, durée, résolution), tags, actions (copier le lien, télécharger, supprimer), clips suggérés / suivants |
| `upload.html`    | Dépôt d'un clip : zone de drop, progression d'un upload en cours, file d'attente, saisie des métadonnées (titre, jeu, tags, visibilité), état de succès |
| `login.html`     | Page de connexion Authentik : nom de l'instance, bouton SSO unique, mention auto-hébergée, état d'erreur discret |

Plus :
- `styles.css` — toutes les variables de thème + composants (partagé par les 4 pages)
- `theme.js` — bascule de thème + persistance `localStorage`, sélecteur visible sur **toutes** les pages
- `notes.md` — 15 à 30 lignes : intentions de design, ce qui distingue chaque thème, ce qui est
  volontairement écarté

## Exigences techniques

- **Aucune dépendance externe obligatoire.** Pas de CDN Tailwind, pas d'images distantes, pas de
  webfont distante pour le rendu de base (une Google Font *optionnelle* avec fallback système est
  tolérée, mais le mockup doit être lisible hors-ligne). Miniatures = placeholders générés en
  CSS/SVG inline (dégradé + libellé), pas de `picsum.photos`.
- Un seul fichier `styles.css` et un seul `theme.js` par variante, référencés en relatif.
- **Les 5 thèmes doivent être implémentés** via un attribut sur `<html>` (`data-theme="ember"`)
  ou des classes, et basculer instantanément sans rechargement. Un thème = un jeu complet de
  variables (fond, surface, surface élevée, bordure, texte, texte faible, accent, accent-contraste).
  Ne pas faire 5 variations de la même couleur : les 5 thèmes doivent être perceptiblement différents
  en température et en contraste, y compris la hiérarchie des surfaces.
- Tailles de cible : **desktop 1440 px** prioritaire, mais pas de layout cassé à 1024 px. Un
  comportement mobile simple (grille qui se replie) est un plus, pas une obligation.
- Contenu factice **réaliste** : noms de jeux et de clips crédibles (pas "Lorem ipsum", pas
  "Item 1"), durées, tailles de fichier, dates relatives ("il y a 2 jours"), pseudos de joueurs.
  La densité d'information et la crédibilité du contenu font partie de la qualité du mockup.

## Style — la ligne rouge

Le commanditaire refuse explicitement une interface "AI slop". Concrètement, **à éviter** :

- Emoji utilisés comme iconographie ; jeux d'icônes incohérents. Utilise des SVG inline dessinés
  avec un trait régulier (stroke cohérent, 1.5–2 px) et une grille de 20 ou 24.
- Dégradés violets/bleus par défaut, glow, glassmorphism généralisé, ombres portées diffuses
  empilées, `border-radius: 24px` sur tout, coins arrondis sur les cartes *et* les boutons *et*
  les champs avec la même valeur.
- Le trio "hero + 3 cards + CTA centré" appliqué à un écran d'application.
- Titres en `font-weight: 800` partout, tracking négatif au hasard, texte gris clair illisible.
- Animations gratuites, `transition: all .3s` sur tout.

**À rechercher :**

- Une grille et un rythme vertical assumés (échelle d'espacement constante, 4 ou 8 px).
- Deux ou trois niveaux de surface maximum, séparés par la bordure et non par l'ombre.
- Une échelle typographique courte et respectée (par ex. 12 / 13 / 15 / 18 / 24), une seule
  famille pour l'UI + éventuellement une mono pour les métadonnées techniques (codec, bitrate,
  taille de fichier).
- Des états honnêtes : hover, focus visible au clavier, sélection, actif, vide, erreur.
- Une identité propre : le mockup doit être reconnaissable au premier coup d'œil et ne pas
  ressembler à ce que produirait un autre modèle. Prends un parti pris, assume-le.

## Livraison

Écris **uniquement** dans le dossier de ta variante, indiqué dans ta tâche. Ne touche à aucun
autre fichier du dépôt. Ne crée pas de README de projet, ne crée pas de package.json, pas de
serveur. À la fin, réponds avec un résumé de 10 lignes maximum : le parti pris de design, les
noms de fichiers écrits, et la commande exacte pour ouvrir le mockup.
