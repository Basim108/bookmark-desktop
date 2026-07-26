## Why

Bookmarks in the right-most column of the canvas render clipped — only part of
the icon is visible (see `design/examples/right-edge-bookmarks-cut.png`).

The cause is arithmetic, not styling. `computeGridCapacity` derives columns as
`floor(availableWidth / iconSize)`, but the grid that consumes that number also
spends `gap: 8px` between every track and `padding: 8px` on each side. The
capacity math never sees that chrome, so the grid is always asked to render
more columns than fit:

```
assumed:  cols · iconSize
actual:   cols · iconSize + (cols − 1) · gap + 2 · padding
```

At a 1918px window with a 240px sidebar (canvas width 1678, tier icon 166px)
this yields 10 columns needing 1748px — a 70px overflow that cuts the last
column's icon in half.

The same omission applies to rows. It has not yet been observed only because
the vertical slack has so far happened to exceed the vertical chrome; at window
heights just past a multiple of the tier size the bottom row will clip too. The
row behaviour is therefore fixed here as well, rather than left as a latent bug.

## What Changes

- Grid capacity is derived from the space cells **actually** consume — tier icon
  size plus inter-cell gap, inside the grid's padding — on both axes, so every
  rendered cell is fully visible within the canvas.
- Leftover space that does not divide evenly is no longer abandoned at the
  right edge. It is distributed **into the cells**: column tracks grow to
  absorb it while the icon stays at its tier size, centred within the wider
  track. Visually this reads as even margins between icons, but every pixel of
  the canvas remains a drop target — widening the *gaps* instead would create
  non-droppable dead zones between columns.
- Vertical leftover space stays where it is today: rows remain anchored to the
  top of the canvas (`align-content: start`), so a half-full folder does not
  float in the middle of the screen. Only the row *count* is corrected — and
  only for the gap/padding it previously ignored. A separate, pre-existing
  cause of bottom-row clipping (the pagination nav consuming grid height that
  the row count never subtracts) is documented in design.md and left for a
  follow-up change; the bottom-row requirement is scoped to single-page
  folders accordingly.
- Grid capacity stays correct continuously while the sidebar is being
  drag-resized, including during the frame between a sidebar width change and
  the canvas's `ResizeObserver` callback, and no cell is ever clipped mid-drag.
- **BREAKING (visible, not data):** on wide windows the corrected formula
  yields one fewer column than today. Capacity shrink never mutates stored
  positions (per *Pinned Position Resilience Under Shrink*), so nothing is
  lost — but existing users will see a one-time reshuffle of their icons, and
  full folders may gain a page.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bookmark-canvas`: the *Responsive Grid Sizing* requirement changes. Capacity
  is no longer plain floor division of available width/height by tier icon
  size; it accounts for inter-cell gap and grid padding. The "leftover space is
  left unused" scenario is replaced: horizontal leftover is distributed into
  column tracks (icons keep their tier size), vertical leftover stays unused
  with rows top-anchored. New scenarios cover full visibility of the last
  column and bottom row, and correctness across a sidebar resize.

## Impact

- `src/lib/grid/sizing.ts` — `computeGridCapacity` gains gap/padding inputs and
  a new formula; exported layout constants.
- `src/lib/grid/sizing.test.ts` — every existing `computeGridCapacity` case
  encodes the old formula and must be rewritten.
- `src/newtab/components/Canvas.tsx` — `gridTemplateColumns` moves from fixed
  `iconSize` tracks to space-absorbing tracks.
- `src/newtab/components/GridCell.tsx` — stops hard-coding cell width so the
  track drives it; the icon keeps its tier size.
- `src/newtab/main.css` — `.canvas-grid` gap/padding become the single source
  of truth shared with the capacity math.
- `src/newtab/hooks/useGridLayout.ts` — passes the layout constants through.
- `e2e/` — new coverage that the last column and bottom row are fully within
  the canvas, and that this holds after a sidebar resize.
- No storage schema change, no migration. Existing stored positions remain
  valid and are re-honoured if capacity ever grows back.
