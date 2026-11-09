# BRIEF — ClipVault, design mockups (v0.1)

## The product

ClipVault is a self-hosted replacement for **Fireshare**: a platform for hosting and
quickly sharing **video game clips**. Target: a small group of self-hosting players
(5 to 50 users) who drop their clips and share them by link.

What Fireshare does badly and ClipVault must do better:

1. **No SSO.** ClipVault authenticates via **Authentik** (OIDC). The login screen is
   therefore minimal: a "Sign in with Authentik" button, the instance name, a clean
   error state. No email/password form (optional, but not the main path).
2. **Dated interface.** Fireshare looks like Bootstrap 4 from 2016: heavy cards, shadows
   everywhere, generic rounded corners, default typography. ClipVault must be
   **minimalist, calm, information-dense, and clearly drawn** — not a template.
3. **Themes.** The user picks among **5 themes**, persisted client-side:
   - **Ember** — deep black + light brown (warm accent, sand/amber)
   - **Tide** — deep black + cyan (cold accent, technical)
   - **Moss** — green + white (plant accent, bright, low saturation)
   - **Aurora** — white + purple (light, purple accent, soft contrast)
   - **Paper** — grey + brown (neutral, paper, almost monochrome, brown accent)

## Mockup scope

**Static HTML mockups**, not an application. No backend, no build, no framework.
Each screen is a standalone `.html` file sharing one CSS and one theme JS.

Screens to produce (4 HTML files per variant):

| File             | Expected content                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| `library.html`   | Main screen: clip grid, search, filters (game, tag, date, duration), sort, empty state, pagination        |
| `watch.html`     | Clip playback: 16:9 player, metadata (game, player, date, duration, resolution), tags, actions (copy link, download, delete), suggested / next clips |
| `upload.html`    | Clip deposit: drop zone, in-progress upload, queue, metadata entry (title, game, tags, visibility), success state |
| `login.html`     | Authentik login page: instance name, single SSO button, self-hosted mention, discreet error state        |

Plus:
- `styles.css` — all theme variables + components (shared by the 4 pages)
- `theme.js` — theme switching + `localStorage` persistence, selector visible on **every** page
- `notes.md` — 15 to 30 lines: design intents, what sets each theme apart, what is
  deliberately left out

## Technical requirements

- **No mandatory external dependency.** No Tailwind CDN, no remote images, no remote
  webfont for base rendering (an *optional* Google Font with a system fallback is
  tolerated, but the mockup must be readable offline). Thumbnails = placeholders generated in
  inline CSS/SVG (gradient + label), no `picsum.photos`.
- A single `styles.css` and a single `theme.js` per variant, referenced relatively.
- **All 5 themes must be implemented** via an attribute on `<html>` (`data-theme="ember"`)
  or classes, and switch instantly without reload. One theme = one complete set of
  variables (background, surface, elevated surface, border, text, muted text, accent, accent-contrast).
  Do not make 5 variations of the same colour: the 5 themes must be perceptibly different
  in temperature and in contrast, including the surface hierarchy.
- Target sizes: **desktop 1440 px** first, but no broken layout at 1024 px. A simple
  mobile behaviour (grid that folds) is a plus, not a requirement.
- **Realistic** dummy content: credible game and clip names (no "Lorem ipsum", no
  "Item 1"), durations, file sizes, relative dates ("2 days ago"), player handles.
  Information density and content credibility are part of the mockup's quality.

## Style — the red line

The client explicitly rejects an "AI slop" interface. Concretely, **to avoid**:

- Emoji used as iconography; inconsistent icon sets. Use inline SVG drawn
  with a regular stroke (consistent stroke, 1.5–2 px) and a 20 or 24 grid.
- Default purple/blue gradients, glow, widespread glassmorphism, stacked diffuse
  drop shadows, `border-radius: 24px` on everything, rounded corners on cards *and* buttons *and*
  fields with the same value.
- The "hero + 3 cards + centred CTA" trio applied to an application screen.
- `font-weight: 800` titles everywhere, random negative tracking, unreadable light grey text.
- Gratuitous animations, `transition: all .3s` on everything.

**To aim for:**

- An assumed grid and vertical rhythm (constant spacing scale, 4 or 8 px).
- Two or three surface levels at most, separated by the border and not by the shadow.
- A short and respected typographic scale (e.g. 12 / 13 / 15 / 18 / 24), a single
  family for the UI + possibly a mono for technical metadata (codec, bitrate,
  file size).
- Honest states: hover, keyboard-visible focus, selection, active, empty, error.
- A distinctive identity: the mockup must be recognisable at first glance and must not
  look like what another model would produce. Take a stance, own it.

## Delivery

Write **only** in your variant's folder, as given in your task. Do not touch any
other file in the repository. Do not create a project README, do not create a package.json, no
server. When done, answer with a summary of 10 lines maximum: the design stance, the
file names written, and the exact command to open the mockup.
