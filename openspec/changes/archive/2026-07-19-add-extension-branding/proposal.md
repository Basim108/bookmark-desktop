## Why

The extension ships with **blank placeholder icons** — `public/icons/icon-16.png`,
`icon-48.png`, and `icon-128.png` are empty grey squares. That is what a user
sees in the Chrome toolbar, the `chrome://extensions` page, the extension
management UI, and (eventually) the Chrome Web Store listing. The product has no
visual identity. This change gives "Bookmark Desktop" a professional, recognizable
logo and wires it into every surface Chrome renders an icon on.

The extension also lacks a proper **public description**. The current manifest
description — "Organize bookmarks in a browser initial page" — is weak and reads
awkwardly; it is what appears on the `chrome://extensions` page and as the Chrome
Web Store *summary*. And there is no authored **store listing description** (the
longer copy shown on the Web Store detail page) anywhere in the repo. This change
also writes both: a tight, benefit-led short description and a comprehensive yet
concise full listing, so the extension is presentable when published.

## What Changes

- Add a **master SVG logo** (`src/assets/logo.svg`) as the single source of truth
  for the mark. Concept: a **launchpad grid of rounded tiles with one accent
  tile** — a direct, modern representation of the product (a desktop of bookmark
  icons). Palette: flat product accent `#1a73e8` on a neutral tile, matching the
  in-app UI.
- Generate **PNG icon exports** at 16, 32, 48, and 128 px from the SVG master
  (32 is added for Windows/HiDPI toolbar rendering; the manifest currently only
  has 16/48/128).
- Add a small **SVG→PNG export step** (a dev dependency + an npm script) so the
  PNGs are regenerated from the SVG master rather than hand-drawn, keeping all
  sizes consistent and the source editable.
- **Wire the icons into the manifest** (`manifest.config.ts`): add the 32px entry
  alongside the existing 16/48/128.
- Set the **new-tab page favicon** to the logo, so the browser tab for the
  extension's own page shows the mark instead of a blank/default favicon.
- Replace the blank placeholder PNGs with the generated ones.
- Rewrite the **short description** (`package.json` `description`, which the
  manifest reads) into a benefit-led sentence within Chrome's 132-character
  summary limit.
- Add a **store listing description** document (`docs/store-listing.md`) holding
  the comprehensive-yet-concise Web Store detail copy — a one-line hook, a short
  intro, a scannable feature list, a "how it works" note, and a privacy/data
  note — as the repo's source of truth for what the publisher pastes into the
  Chrome Web Store dashboard.

Out of scope: no toolbar action/popup exists (the extension is a new-tab
override), so there is no browser-action icon to theme; animated or dark/light
icon variants are not included in v1. The full listing copy is stored in the repo
but is entered into the Web Store dashboard manually (Chrome has no manifest field
for the long description); screenshots/promo tiles for the listing are not part of
this change.

## Capabilities

### New Capabilities
- `extension-branding`: the extension's public identity — a single SVG master
  logo, the PNG icon sizes Chrome requires (16/32/48/128) generated from it, the
  manifest wiring that surfaces them in the toolbar/extensions page, the new-tab
  page favicon, and the extension's public descriptions (the manifest short
  description and the maintained store-listing copy).

### Modified Capabilities
<!-- None: this change adds branding assets and manifest wiring; no existing capability's behavior changes. -->

## Impact

- Affected code / assets:
  - `src/assets/logo.svg` (new) — the master SVG logo.
  - `public/icons/icon-16.png`, `icon-32.png` (new), `icon-48.png`,
    `icon-128.png` — regenerated from the SVG (replacing the blank placeholders).
  - `manifest.config.ts` — add the `32` icon entry to the `icons` map.
  - `src/newtab/index.html` — add a `<link rel="icon">` pointing at the logo.
  - `package.json` — a dev dependency for SVG rasterization (e.g. `sharp`) and an
    `icons:generate` script that renders the PNG sizes from `logo.svg`.
  - `scripts/generate-icons.mjs` (new) — the rasterization script.
  - `package.json` `description` — rewritten short description (also raises the
    manifest description, which reads `pkg.description`).
  - `docs/store-listing.md` (new) — the full Web Store listing copy.
  - `README.md` documentation table — a row linking the store-listing doc (to
    match how the repo indexes its other docs).
- No new manifest permissions; no runtime behavior change. Icons are static
  assets bundled by the existing Vite/`@crxjs` build; the descriptions are
  metadata/copy.
- The generated PNGs are committed (so a normal `npm run build` needs no image
  toolchain); the generate script is only run when the logo changes.
