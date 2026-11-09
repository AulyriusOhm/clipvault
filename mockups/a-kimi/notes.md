# ClipVault — a-kimi variant

The stance is that of an **archive registry**: a technical, quiet vault, not a consumer streaming site.
The sidebar, the `CV–0248` identifiers, the thin rules and the mono labels give it the identity of an indexed catalogue.
Thumbnails use abstract SVG compositions specific to each game, with a video grid and framing marks.
No drop shadows: the three surface levels are told apart by colour and one-pixel borders.
Angles stay almost square; only avatars, indicators and playback controls are circular.
The type hierarchy is short, titles are semi-bold and technical metadata is set in monospace.
Forms, hovers, keyboard focus, progress, success, error and empty state all have explicit visual states.
The grid is designed for 1440 px, tightens at 1024 px, then folds navigation and content on small screens.

**Ember** is the reference theme: warm black, very dark brown surfaces and a sand accent for night use.
**Tide** keeps the low luminance but moves the whole hierarchy to cold slates and a technical cyan.
**Moss** genuinely inverts the contrast: greyish green background, white surfaces and a low-saturation plant accent.
**Aurora** is light and soft, with neutral lavender surfaces and purple reserved for actions and selections.
**Paper** uses a warm grey background, ivory surfaces and a brown accent for an almost monochrome read.
Each theme redefines background, two surfaces, borders, text, accent, accent contrast and state colours.
The choice is applied on `<html data-theme>` without reload and kept in `localStorage` across the four pages.

Deliberately left out: glassmorphism, halos, diffuse shadows, emojis, remote illustration and decorative animations.
The player, the filters and the actions are static mockups; only the theme selector and the expandable empty state are live.
No dependency, font, image or network request is needed: each HTML file works directly offline.
