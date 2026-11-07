# ClipVault — variante c-deepseek
**Parti pris : planche contact d'archive.** La bibliothèque est une table lumineuse : cellules
jointives, filets de 1 px, jamais d'ombre. Angles vifs (0 px, 2 px sur les seuls contrôles), aucun
glow, aucun dégradé d'accent. Chaque vignette porte une bande de perforations et un numéro de leader
en filigrane, motif repris sur le player et le login. Les stills restent sombres quel que soit le
thème : une image de jeu ne s'éclaircit pas parce que l'UI passe en clair.

**Typographie.** Une sans-serif pour la prose et les titres, une mono pour tout ce qui est mesurable :
timecode, codec, débit, taille, identifiant, dates relatives, libellés en capitales espacées. Échelle
courte et tenue : 10 / 11 / 12 / 13 / 15 / 18 / 24. Graisse max 600, sur le nom du produit seul.
Rythme vertical en 4/8 px.

**Surfaces.** `--bg` page, `--surface` cellules et panneaux, `--elevated` survol et actif. La
hiérarchie change de sens selon le thème, pas seulement de teinte : Ember et Tide empilent du plus
sombre au plus clair, Moss et Aurora partent d'un fond teinté vers du blanc, Paper descend d'un gris
kraft vers un papier blanc.
- **Ember** — noir chaud #121010, ambre #e08b3c. Le plus contrasté, lecture nocturne.
- **Tide** — noir bleuté #070b0e, cyan #3ec9d6. Accent le plus saturé, rendu « console ».
- **Moss** — vert pâle et blanc, accent végétal désaturé #4c7a3c. Lumineux, sans éclat.
- **Aurora** — blanc lavande, violet #6a4bd6, contraste volontairement doux.
- **Paper** — gris et brun, quasi monochrome #7b5b3c. Aucune couleur franche, tout en valeur.

**Thèmes.** Variables par thème sur `<html data-theme>`, bascule instantanée, `localStorage`
(`clipvault.theme`), `color-scheme` accordé, `<meta name="theme-color">` mis à jour. Sélecteur rendu
par `theme.js` (source unique des couleurs d'aperçu) : cinq pastilles dans le rail, barre flottante
sur le login, `Alt+1..5`, `aria-pressed`.

**Écarté.** Hero + trois cartes + CTA ; ombres diffuses et glassmorphism ; rayons uniformes ; emoji
comme iconographie ; `transition: all` ; gris clair illisible ; formulaire email/mot de passe (le SSO
Authentik est l'unique voie, l'erreur OIDC est montrée telle quelle, en petit).
