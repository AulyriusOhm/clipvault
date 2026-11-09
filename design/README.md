# ClipVault — reference design

Variant selected after the blind test: "Vault Ledger", hardened.

Open `index.html` (contents), or directly `library.html` to enter the mockup.

## Screens

| File | Content |
| --- | --- |
| `index.html` | Contents: screens, themes, fixes, open points |
| `library.html` | Clip grid, search, filters, sort, pagination, empty state |
| `watch.html` | Player, technical metadata, tags, file history |
| `upload.html` | Drop, four-state queue, metadata, confirmation |
| `login.html` | Authentik SSO, OIDC error, read-only |
| `share.html` | Public view of a shared link, without an account |
| `404.html` | Deleted clip + table of the other error codes |

## Themes

Ember, Tide, Moss, Aurora, Paper. Switch with the selector swatches or
`Alt+1` to `Alt+5`, persisted in `localStorage` (`clipvault.theme`).
`theme.js` is the single source of colours: no value is duplicated
in the HTML.

## Fixes applied after selection

Accessibility — skip link, `prefers-reduced-motion`, `role="progressbar"`
on upload bars, `aria-live` on the queue, `role="status"` on the
confirmation, `role="alert"` on the sign-in error, `aria-current="page"`,
`aria-hidden` + `focusable="false"` on decorative icons, `tabindex` on
the playback sliders.

Code — theme swatches painted from a single table, `meta theme-color`
and `color-scheme` kept in sync, keyboard shortcuts.

## Constraints met

No framework, no build, no network request: system fonts, inline
SVG icons, CSS gradient thumbnails. Each page opens on its own from
disk.

## Open points

- Instance settings, members and invitations, player profile.
- Default expiry of a public link, per-member quota, transcoding.
- No specifically drawn mobile view (the rail collapses below 760 px).
