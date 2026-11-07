# ClipVault — variante B « Vault Ledger » (b-mimo)

## Parti pris
Un outil d'archive, pas une vitrine : bordures 1 px, aucune ombre, rayons 2–3 px, grille de
points 24 px en fond. L'interface reste calme et presque monochrome ; la couleur vient des clips.
Deux registres typographiques seulement : sans-serif système pour l'UI (11/12/13/15/18/24) et
mono à chasse fixe pour tout ce qui est technique (durées, tailles, codec, débit, URLs, codes).
Signature : micro-libellés capitales suivis d'un filet, index des jeux dans une colonne de
gauche dense, et une ligne de statut mono sous chaque titre de page (`vault://la-taniere — …`).

## Ce qui distingue chaque thème
- **Ember** (défaut) : fond brun quasi noir, surfaces chaudes, accent ambre — le feu de forge.
- **Tide** : fond bleu-nuit froid, surfaces ardoise, accent cyan technique — la salle machine.
- **Moss** : thème clair, fond vert pâle très désaturé, accent végétal — herbe et papier.
- **Aurora** : thème clair blanc-violet, contraste doux, accent violet franc — le plus lumineux.
- **Paper** : thème clair gris-beige presque neutre, accent brun, grisés partout — le classeur.
Les 5 thèmes basculent sans rechargement (`data-theme` sur `<html>`, persistance `localStorage`)
et changent aussi la température des surfaces, pas seulement l'accent.

## Choix assumés
- Miniatures = dégradés CSS par jeu + lignes de balayage + code de frame (`#0231`) : la couleur
  des vignettes reste identique dans les 5 thèmes, comme le ferait une vraie capture.
- Icônes : un seul jeu SVG inline (grille 24, trait 1,75, embouts carrés), servi via `<symbol>`.
- États honnêtes montrés sur les écrans : vide (library), en cours / en attente / terminé /
  échec (upload), succès de publication (upload), erreur de connexion (login), hover/focus.

## Volontairement écarté
Aucun emoji, aucune icône générique du web, aucune ombre portée, pas de glassmorphism, pas de
dégradé violet/bleu décoratif, pas de coins arrondis 24 px, pas de héros marketing centré, pas
de font distante, aucune image externe ni CDN : tout tient dans 7 fichiers statiques.
