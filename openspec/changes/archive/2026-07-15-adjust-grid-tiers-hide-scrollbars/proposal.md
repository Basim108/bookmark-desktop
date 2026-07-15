## Why

The canvas grid's 3-tier step function (`sizing.ts`) currently names its tier constants "icon size," but that value is actually the grid **cell** size — the rendered bookmark glyph is a fixed 60% of it (`.favicon-image`/`.custom-icon { width: 60%; height: 60% }` in `main.css`), so the icon a user actually sees is 28.8px/37.8px/60px, not the 48px/63px/100px the constant names imply. Raising the three cell-tier constants so the 60%-shrunk glyph reads close to 48/63/100px fixes that gap without touching the shrink rule itself or the step-function approach established in the prior grid-sizing redesign. Separately, the canvas currently shows native scrollbars (`.canvas-grid { overflow: auto }`) even though pagination already handles overflow — hiding them (as the sidebar already does) removes a redundant, visually inconsistent scroll affordance.

## What Changes

- Update `SMALL_ICON_SIZE`, `MEDIUM_ICON_SIZE`, `LARGE_ICON_SIZE` in `src/lib/grid/sizing.ts` from `48`/`63`/`100` to `80`/`106`/`166`. `MEDIUM_BREAKPOINT` (1660) and `LARGE_BREAKPOINT` (2100) viewport-width thresholds are unchanged.
- The `.favicon-image`/`.custom-icon`/`.favicon-fallback` 60% CSS shrink rule in `main.css` is explicitly left untouched — this change only moves the cell-size input to that existing rule, so the rendered glyph lands at ~48px/~63.6px/~99.6px instead of 28.8px/37.8px/60px.
- Grid capacity (`cols`/`rows`, via `computeGridCapacity`'s floor division) changes as a direct consequence of the larger tier values — fewer columns/rows fit per page at every tier than today.
- Hide the canvas grid's native horizontal and vertical scrollbar controls (`.canvas-grid` in `main.css`) while preserving programmatic/wheel/trackpad scrollability, mirroring the existing sidebar scrollbar-hiding behavior (`folder-sidebar` spec's "Sidebar Hides Native Scroll Controls").

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `bookmark-canvas`: "Responsive Grid Sizing" requirement's three tier values change from 48px/63px/100px to 80px/106px/166px; a new requirement is added for hiding the canvas's native scrollbar controls, mirroring the sidebar's existing equivalent requirement.

## Impact

- `src/lib/grid/sizing.ts` — three constants changed.
- `src/newtab/main.css` — `.canvas-grid` gets scrollbar-hiding rules; `.favicon-image`/`.custom-icon`/`.favicon-fallback` 60% rule unchanged (explicitly out of scope).
- `src/lib/grid/sizing.test.ts` — existing tier-boundary assertions (e.g. `resolveTierIconSize(1659) === 48`) need updating to the new values.
- Downstream capacity consumers (`useGridLayout.ts`, `Canvas.tsx`, `GridCell.tsx`, `BookmarkIcon.tsx`) are unaffected in logic — they consume whatever `resolveTierIconSize` returns without hardcoding 48/63/100 themselves.
- `FaviconImage`/`getFaviconUrl` fetch resolution scales up proportionally (still requests at full cell size, not glyph size) — no code change required, but fetched images will be larger than before.
