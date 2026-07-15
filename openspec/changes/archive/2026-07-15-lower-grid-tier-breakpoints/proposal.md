## Why

The grid's 3-tier step function currently switches to its largest tier (166px icons, 1rem labels) only once the canvas's own available width reaches 2100px — a genuinely wide monitor with a slim sidebar. In practice, most normal browser window widths (roughly 500–2100px of canvas width) sit in the small or medium tier, which reads as visually undersized for typical everyday window sizes. Lowering the breakpoints makes the largest, most comfortable tier the default for ordinary windows, reserving the two smaller tiers for genuinely narrow ones.

## What Changes

- `src/lib/grid/sizing.ts`: `MEDIUM_BREAKPOINT` changes from `1660` to `512`, and `LARGE_BREAKPOINT` changes from `2100` to `1024`. The tier values themselves (80px/0.75rem, 106px/0.85rem, 166px/1rem) and the measurement basis (the canvas's own available width, via `useGridLayout`'s `containerRef`/`useElementSize` — not the raw browser window/viewport width, and not the sidebar's width) are unchanged.
- No other code changes: `resolveTier`'s shape, the label-font-size reporting bridge (`Canvas` → `App` → `--label-font-size` CSS variable → `.folder-label`/`.bookmark-icon-label`), and grid capacity math are all untouched — folder names already track bookmark label font-size via that existing mechanism and continue to do so unchanged.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `bookmark-canvas`: "Responsive Grid Sizing" requirement's three scenarios update their width thresholds from 1660px/2100px to 512px/1024px; tier icon sizes and label font-sizes per scenario are unchanged.

## Impact

- `src/lib/grid/sizing.ts` — two constants changed.
- `src/lib/grid/sizing.test.ts` — boundary-case assertions (currently at 1659/1660/2099/2100) updated to the new boundaries (511/512/1023/1024).
- `src/newtab/components/Canvas.test.tsx` — the two tier-boundary tests ("sizes cells at the 106px tier...", "sizes cells at the 166px tier...") currently resize to widths inside the old 1660–2100 range; need to resize to widths inside the new 512–1024 range instead so they still land in the tier they claim to test.
- No change to `useGridLayout.ts`, `App.tsx`, `Canvas.tsx`, or `main.css` — the label-font-size bridge and CSS wiring added in the prior change require no modification.
- The sidebar's own independent width-tiering (`useSidebarResize`, 1024px/1920px breakpoints) is a separate system and is not touched — note its own `1024` breakpoint is coincidentally the same number as this change's new `LARGE_BREAKPOINT`, but the two remain unrelated, independently-measured values.
