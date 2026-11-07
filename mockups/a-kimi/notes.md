# ClipVault — variante a-kimi

Le parti pris est celui d’une **régie d’archive** : un coffre technique et calme, pas un site de streaming grand public.
La colonne latérale, les identifiants `CV–0248`, les filets fins et les libellés mono donnent une identité de catalogue indexé.
Les miniatures utilisent des compositions SVG abstraites propres à chaque jeu, avec trame vidéo et repères de cadrage.
Aucune ombre portée : les trois niveaux de surface sont distingués par la couleur et des bordures d’un pixel.
Les angles restent presque droits ; seuls les avatars, indicateurs et commandes de lecture sont circulaires.
La hiérarchie typographique est courte, les titres sont semi-gras et les métadonnées techniques passent en monospace.
Les formulaires, survols, focus clavier, progression, succès, erreur et état vide ont des états visuels explicites.
La grille est pensée pour 1440 px, se resserre à 1024 px puis replie navigation et contenu sur petit écran.

**Ember** est le thème de référence : noir chaud, surfaces brunes très sombres et accent sable pour un usage nocturne.
**Tide** conserve la faible luminance mais déplace toute la hiérarchie vers les ardoises froides et un cyan technique.
**Moss** inverse réellement le contraste : fond vert grisé, surfaces blanches et accent végétal peu saturé.
**Aurora** est clair et doux, avec des surfaces lavande neutres et un violet réservé aux actions et sélections.
**Paper** adopte un fond gris chaud, des surfaces ivoire et un accent brun pour une lecture presque monochrome.
Chaque thème redéfinit fond, deux surfaces, bordures, textes, accent, contraste d’accent et couleurs d’état.
Le choix est appliqué sur `<html data-theme>` sans rechargement et conservé dans `localStorage` sur les quatre pages.

Sont volontairement écartés : glassmorphism, halos, ombres diffuses, emojis, illustration distante et animations décoratives.
Le lecteur, les filtres et les actions sont des maquettes statiques ; seuls le sélecteur de thème et l’état vide dépliable sont actifs.
Aucune dépendance, police, image ou requête réseau n’est nécessaire : chaque HTML fonctionne directement hors-ligne.
