## Context

The extension's three icon files are blank grey placeholders. Chrome renders them
in the toolbar (16 px), the extensions page and management UI (48 px), and the
install/Web-Store surfaces (128 px); 32 px is used for Windows/HiDPI toolbar
rendering. The extension is a new-tab override (no browser-action popup), so the
only icon surfaces are the manifest `icons` map and the new-tab page's own tab
favicon. The mark must be recognizable down to 16 px.

Chosen identity (confirmed with the user): a **launchpad grid** — a 2×2 grid of
rounded tiles, three neutral and one in the product accent `#1a73e8`, on a
rounded-square container. It reads as "a desktop of bookmark icons" and matches
the in-app blue.

## Goals / Non-Goals

Goals:
- A single editable SVG master; all PNG sizes generated from it, reproducibly.
- Crisp, legible rendering at every required size, especially 16 px.
- Consistent contrast across light and dark browser toolbars.
- No new manifest permissions; no runtime behavior change.

Non-Goals:
- Animated, or separate dark/light icon variants (v1 uses one mark).
- A browser-action/toolbar-popup icon (there is no action surface).
- A full brand system (wordmark, marketing assets) — just the app icon + favicon.

## Decision 1 — Logo geometry (the SVG master)

`src/assets/logo.svg`, `viewBox="0 0 128 128"`. Structure:

```
┌───────────────────────────┐   rounded-square container
│   ┌─────┐     ┌─────┐      │   (rx ≈ 28), subtle fill so
│   │  ▢  │     │  ▢  │      │   the tiles always have a
│   └─────┘     └─────┘      │   backdrop on any toolbar
│                            │
│   ┌─────┐     ┌─────┐      │   2×2 grid of rounded tiles
│   │  ▢  │     │  ██ │◀ blue │   (rx ≈ 0.28·tile)
│   └─────┘     └─────┘      │   bottom-right tile = #1a73e8
└───────────────────────────┘   the other three = neutral
```

Concrete starting values (tuned against real renders in apply):
- Container: rounded rect inset ~4 px, `rx ≈ 28`, fill a near-white card
  (`#f1f3f4`) so the neutral tiles read and the whole mark holds an edge on both
  light and dark toolbars; a 1 px inner border may be added if 16 px needs it.
- Tiles: 2×2 with outer padding ~22 and gap ~14, tile size ~34, `rx ≈ 10`.
- Colors: three tiles neutral (`#c4c9d0`), the bottom-right tile accent
  `#1a73e8` (flat, per the user's choice). All flat fills — no gradients.

Rationale for 2×2 (not 3×3): four large tiles stay distinct at 16 px, where a
3×3 grid collapses into noise. The single accent tile is the focal point and
survives downscaling.

## Decision 2 — Rasterization (SVG → PNG)

No rasterizer is installed. Add `@resvg/resvg-js` as a **devDependency** and a
`scripts/generate-icons.mjs` that renders each size **natively at its target
width** (not render-then-resize), which keeps small sizes crisp:

```js
import { Resvg } from "@resvg/resvg-js";
for (const size of [16, 32, 48, 128]) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } })
    .render().asPng();
  writeFileSync(`public/icons/icon-${size}.png`, png);
}
```

- `@resvg/resvg-js` ships prebuilt platform binaries and does one job well
  (SVG→PNG); chosen over `sharp` (heavier, image-processing native stack) since
  we only need rasterization. Fallback if it fails to install in CI: `sharp`
  with a raised `density` then `.resize(size)`.
- Wire an `"icons:generate": "node scripts/generate-icons.mjs"` npm script.
- **The generated PNGs are committed.** A normal `npm run build` therefore needs
  no image toolchain and CI is unaffected; the script runs only when the logo
  changes. This keeps the rasterizer out of the build's critical path.

## Decision 3 — Manifest and new-tab favicon wiring

- `manifest.config.ts`: add `32: "public/icons/icon-32.png"` to the `icons` map
  (keeping 16/48/128). Note the existing entries are pathed under `public/` —
  match that exact convention so `@crxjs` resolves them the same way.
- New-tab favicon: add `<link rel="icon" href="/icons/icon-32.png">` to
  `src/newtab/index.html`. `@crxjs` copies `public/` to the build root, so
  `/icons/icon-32.png` resolves at runtime (verify the emitted path during
  apply; if the root copy isn't present, reference the manifest-relative path or
  add an explicit `<link>` to the SVG copied into `public/`).

## Decision 4 — Public descriptions

Two distinct pieces of copy with different homes:

| Copy | Home | Limit | Surfaces |
|---|---|---|---|
| Short description | `package.json` `description` (manifest reads `pkg.description`) | **132 chars** (Chrome) | extensions page, Web Store *summary* |
| Full listing | `docs/store-listing.md` (repo source of truth) | ~ up to 16,000 chars | Web Store detail page (pasted in manually) |

Chrome has no manifest field for the long description, so the full copy lives in
the repo as a doc the publisher pastes into the dashboard; keeping it in-repo
means it is version-controlled and reviewable alongside the code.

**Short description (draft, finalized in apply):**
> Turn Chrome's new tab into a desktop of your bookmarks — a customizable grid of
> icons with a folder sidebar. (~110 chars)

This replaces the weak, ungrammatical current value ("Organize bookmarks in a
browser initial page").

**Full listing structure (`docs/store-listing.md`):**
1. **Hook** — one line, e.g. "Your bookmarks, as a desktop."
2. **Intro** — 2–3 sentences on what it does and who it's for.
3. **Key features** — a scannable bullet list drawn only from shipped behavior:
   bookmark/subfolder icons on a paginated grid, per-item positions that persist,
   responsive icon scaling, a folder sidebar backed by Chrome's native tree,
   favicons with a fallback plus custom per-item icons, label display options, a
   custom canvas background, live multi-tab sync, drag-and-drop arranging, uTab
   import, and full export/import of your setup.
4. **How it works** — Chrome's own bookmarks are the source of truth; layout and
   settings persist locally.
5. **Privacy & permissions** — bookmark data stays in the browser; nothing is
   sent off-device beyond the declared HTTPS favicon fetches.

Tone: plain, confident, user-facing; no jargon; claims limited to what ships
(see the spec's "matches actual capabilities" scenario). The `README.md` doc
table gains a row pointing at `docs/store-listing.md`, matching how the repo
indexes `local_use.md` and the others.

## Risks / Trade-offs

- **16 px legibility.** The main risk. Mitigated by 2×2 (not 3×3), a container
  backdrop for contrast, and a task to eyeball the actual 16 px PNG and adjust
  padding/gap/border before finalizing.
- **Toolbar theme contrast.** A near-white container can lose its edge on a light
  toolbar; Chrome adds slight separation, but a subtle 1 px border/inner shadow
  is the fallback if it looks flat at 16 px.
- **Native dep install.** `@resvg/resvg-js` is prebuilt but adds a devDependency;
  since generated PNGs are committed, a failure only blocks re-generation, never
  the build. `sharp` is the documented fallback.

## Migration

None. Assets and manifest metadata only; no stored data, no behavior change. The
blank placeholder PNGs are overwritten in place at the same paths.

## Open Questions

- Container fill: near-white card vs. transparent vs. a soft tint — resolve by
  comparing real 16/48/128 renders during apply (default: near-white card).
- Favicon source: 32 px PNG (simple, chosen) vs. an SVG favicon (crisper on
  HiDPI) — PNG unless the SVG path is trivially available at the page root.
