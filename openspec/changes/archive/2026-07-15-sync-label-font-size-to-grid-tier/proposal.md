## Why

Folder names in the sidebar and bookmark names on the canvas currently render at a fixed size (`.folder-label` inherits the browser default ~1rem; `.bookmark-icon-label` is hardcoded to `0.75rem`) regardless of viewport size, even though the grid's icon/cell size already scales through three tiers (80px/106px/166px) as the canvas gets more available width. At the largest tier, small fixed-size text next to a 166px icon reads as visually undersized; syncing label size to the same tier makes the whole canvas+sidebar scale together.

## What Changes

- `src/lib/grid/sizing.ts`: replace `resolveTierIconSize(availableWidth): number` with a single combined tier-resolution function returning both `iconSize` and `labelFontSize` for a given available width, so the two values can never drift out of sync by editing one branch and not the other. Breakpoints (1660px/2100px) are unchanged. Tiers: 80px/`0.75rem`, 106px/`0.85rem`, 166px/`1rem`.
- `src/newtab/hooks/useGridLayout.ts` and `src/newtab/components/Canvas.tsx`: consume the new combined function; `Canvas` gains a callback prop (e.g. `onLabelFontSizeChange`) invoked whenever the resolved tier's `labelFontSize` changes, reporting the value upward without changing where the canvas's available-width measurement itself lives (still Canvas's own `containerRef`/`useElementSize`, not window or sidebar width).
- `src/newtab/App.tsx`: `AppContent` receives the reported `labelFontSize` via the new callback, holds it in state, and sets it as a CSS custom property (`--label-font-size`) inline on the `.app` div it already renders — the first CSS custom property used anywhere in this codebase.
- `src/newtab/main.css`: `.folder-label` and `.bookmark-icon-label` both get `font-size: var(--label-font-size)`, replacing the hardcoded `0.75rem` on `.bookmark-icon-label` and adding a font-size rule to `.folder-label` (previously unstyled). `.folder-settings-panel`'s separate `0.75rem` rule is untouched.
- A sensible default value for `--label-font-size` is set on `.app` so the sidebar (which can render before any folder/canvas is selected, or when no folder exists) never has an unset custom property — defaults to the smallest tier's `0.75rem`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `bookmark-canvas`: "Responsive Grid Sizing" requirement's tier definition changes from an icon-size-only step function to one that also fixes a label font-size per tier, and a new requirement is added for bookmark-label font-size following that same tier.
- `folder-sidebar`: a new requirement is added stating folder-row label font-size follows the same 3-tier step function as the canvas grid (not the sidebar's own independent width-tier system).

## Impact

- `src/lib/grid/sizing.ts` — `resolveTierIconSize` replaced by a combined tier-resolution function; `sizing.test.ts` updated accordingly.
- `src/newtab/hooks/useGridLayout.ts` — internal tier resolution updated to the combined function; hook/interface may gain the resolved `labelFontSize` alongside existing `iconSize`.
- `src/newtab/components/Canvas.tsx` — new callback prop to report `labelFontSize` upward.
- `src/newtab/App.tsx` — new state + CSS custom property set on `.app`.
- `src/newtab/main.css` — `.folder-label` and `.bookmark-icon-label` font-size rules.
- No change to grid capacity math, pagination, positions, or the sidebar's own independent max-width tiering (`useSidebarResize`, 1024px/1920px breakpoints) — that system is unrelated and untouched.
