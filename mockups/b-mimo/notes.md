# ClipVault — variant B "Vault Ledger" (b-mimo)

## Stance
An archive tool, not a shop window: 1 px borders, no shadow, 2–3 px radii, a
24 px dot grid in the background. The interface stays calm and almost monochrome;
colour comes from the clips.
Only two typographic registers: system sans-serif for the UI (11/12/13/15/18/24) and
a fixed-pitch mono for anything technical (durations, sizes, codec, bitrate, URLs, codes).
Signature: uppercase micro-labels followed by a rule, a game index in a dense left
column, and a mono status line under each page title (`vault://la-taniere — …`).

## What sets each theme apart
- **Ember** (default): near-black brown background, warm surfaces, amber accent — forge fire.
- **Tide**: cold night-blue background, slate surfaces, technical cyan accent — the machine room.
- **Moss**: light theme, very desaturated pale green background, plant accent — grass and paper.
- **Aurora**: light white-purple theme, soft contrast, frank purple accent — the brightest.
- **Paper**: light, almost neutral grey-beige theme, brown accent, greys everywhere — the binder.
The 5 themes switch without reload (`data-theme` on `<html>`, `localStorage` persistence)
and also change the temperature of the surfaces, not just the accent.

## Deliberate choices
- Thumbnails = per-game CSS gradients + scanlines + frame code (`#0231`): the thumbnail
  colour stays identical across the 5 themes, as a real screenshot would.
- Icons: a single inline SVG set (24 grid, 1.75 stroke, square caps), served via `<symbol>`.
- Honest states shown on the screens: empty (library), uploading / queued / done /
  failed (upload), publish success (upload), sign-in error (login), hover/focus.

## Deliberately left out
No emoji, no generic web icons, no drop shadows, no glassmorphism, no decorative
purple/blue gradient, no 24 px rounded corners, no centred marketing hero, no
remote font, no external image or CDN: everything fits in 7 static files.
