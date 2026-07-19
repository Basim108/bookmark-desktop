# Tasks

## 1. Master SVG logo
- [x] 1.1 Add `src/assets/logo.svg` (`viewBox="0 0 128 128"`): a rounded-square container (`rx ≈ 28`, near-white `#f1f3f4` fill) holding a 2×2 grid of rounded tiles (`rx ≈ 10`), three neutral (`#c4c9d0`) and the bottom-right tile accent `#1a73e8`, all flat fills. Use the padding/gap/size starting values from design (padding ~22, gap ~14, tile ~34).
- [x] 1.2 Sanity-check the SVG renders (opens as a valid image) and the accent tile is clearly the focal point.

## 2. Icon generation (SVG → PNG)
- [x] 2.1 Add `@resvg/resvg-js` as a devDependency.
- [x] 2.2 Add `scripts/generate-icons.mjs` that reads `src/assets/logo.svg` and renders `public/icons/icon-{16,32,48,128}.png`, each rendered natively at its target width via `fitTo: { mode: "width", value: size }`.
- [x] 2.3 Add an `"icons:generate": "node scripts/generate-icons.mjs"` script to `package.json`.
- [x] 2.4 Run `npm run icons:generate` to overwrite the blank placeholders with the rendered logo; commit the generated PNGs.

## 3. Small-size legibility pass
- [x] 3.1 Inspect the generated 16 px and 32 px PNGs; if the container edge is lost on a light toolbar or the tiles blur together, adjust the SVG (padding/gap, add a 1 px inner border, or nudge the neutral tile tone) and re-generate.
- [x] 3.2 Confirm 48 px and 128 px look crisp and balanced.

## 4. Wiring
- [x] 4.1 `manifest.config.ts`: add `32: "public/icons/icon-32.png"` to the `icons` map (keep 16/48/128), matching the existing `public/`-prefixed path convention.
- [x] 4.2 `src/newtab/index.html`: add `<link rel="icon" href="/icons/icon-32.png">`; after building, verify the emitted path resolves (fall back to the manifest-relative path or an SVG-in-`public/` favicon if the root copy isn't present).

## 5. Public descriptions
- [x] 5.1 Rewrite `package.json` `description` into a benefit-led, grammatically clean summary within Chrome's 132-character limit (start from the design draft: "Turn Chrome's new tab into a desktop of your bookmarks — a customizable grid of icons with a folder sidebar."); confirm the built manifest `description` picks it up and is ≤132 chars.
- [x] 5.2 Write `docs/store-listing.md` with the full Web Store copy: hook, intro, scannable key-feature list, "how it works", and a privacy/data note — drawing every feature claim only from shipped behavior (cross-check against README/specs so nothing aspirational is claimed).
- [x] 5.3 Add a row to the `README.md` documentation table linking `docs/store-listing.md`.

## 6. Verification
- [x] 6.1 `npm run build` succeeds; the built manifest references 16/32/48/128 and each PNG exists in `dist` and is a non-blank render of the logo; the manifest `description` is the new copy and ≤132 chars.
- [x] 6.2 Load the unpacked `dist` in Chrome: the toolbar/extensions-page icon shows the logo (not a blank square), the extensions-page description reads the new short copy, and the new-tab page's browser tab shows the logo favicon.
- [x] 6.3 Run typecheck and lint green.
- [x] 6.4 `openspec validate add-extension-branding --strict` passes.
