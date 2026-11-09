# ClipVault — c-deepseek variant
**Stance: archive contact sheet.** The library is a light table: flush
cells, 1 px rules, never a shadow. Sharp corners (0 px, 2 px on the controls only), no
glow, no accent gradient. Each thumbnail carries a strip of sprocket holes and a leader
number in watermark, a motif repeated on the player and the login. Stills stay dark whatever the
theme: a game image does not get lighter because the UI switches to light.

**Typography.** A sans-serif for prose and titles, a mono for anything measurable:
timecode, codec, bitrate, size, identifier, relative dates, uppercase spaced labels. Short,
tight scale: 10 / 11 / 12 / 13 / 15 / 18 / 24. Weight max 600, on the product
name only. Vertical rhythm in 4/8 px.

**Surfaces.** `--bg` page, `--surface` cells and panels, `--elevated` hover and active. The
hierarchy changes direction with the theme, not just hue: Ember and Tide stack from
darkest to lightest, Moss and Aurora start from a tinted background towards white, Paper descends
from a kraft grey to a white paper.
- **Ember** — warm black #121010, amber #e08b3c. The most contrasted, night reading.
- **Tide** — bluish black #070b0e, cyan #3ec9d6. Most saturated accent, "console" rendering.
- **Moss** — pale green and white, desaturated plant accent #4c7a3c. Bright, without glare.
- **Aurora** — lavender white, purple #6a4bd6, deliberately soft contrast.
- **Paper** — grey and brown, almost monochrome #7b5b3c. No frank colour, all in value.

**Themes.** Per-theme variables on `<html data-theme>`, instant switch, `localStorage`
(`clipvault.theme`), matching `color-scheme`, `<meta name="theme-color">` updated. Selector
rendered by `theme.js` (single source of preview colours): five swatches in the rail, floating
bar on the login, `Alt+1..5`, `aria-pressed`.

**Left out.** Hero + three cards + CTA; diffuse shadows and glassmorphism; uniform radii; emoji
as iconography; `transition: all`; unreadable light grey; email/password form (the
Authentik SSO is the only path, the OIDC error is shown as is, in small type).
