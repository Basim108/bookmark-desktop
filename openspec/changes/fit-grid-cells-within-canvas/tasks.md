## 1. Capacity math

- [x] 1.1 Export `GRID_GAP` (8) and `GRID_PADDING` (8) from `src/lib/grid/sizing.ts` as the single source of truth for the grid's layout constants
- [x] 1.2 Change `computeGridCapacity` to take gap and padding and derive each axis as `max(1, floor((max(0, available − 2·padding) + gap) / (icon + gap)))`
- [x] 1.3 Confirm `resolveTier` still receives the raw available width (not the padding-reduced width) so the 512/1024 breakpoints are unchanged
- [x] 1.4 Rewrite `src/lib/grid/sizing.test.ts`'s `computeGridCapacity` cases against the new formula — all three existing cases encode the old one
- [x] 1.5 Add unit cases: the screenshot configuration (1678 × 166 → 9 cols, not 10); an exact-fit width with zero leftover; a width smaller than one cell plus padding (→ 1); and the row axis derived identically

## 2. Rendering

- [x] 2.1 Pass the layout constants through `useGridLayout`'s `computeCapacityAndTier` into `computeGridCapacity`
- [x] 2.2 In `Canvas.tsx`, change `gridTemplateColumns` to `repeat(${capacity.cols}, minmax(0, 1fr))`, keeping `gridTemplateRows` at fixed `iconSize` tracks
- [x] 2.3 Apply `gap` and `padding` to `.canvas-grid` as inline style from the exported constants, and remove the `gap`/`padding` declarations from `.canvas-grid` in `src/newtab/main.css` so the values cannot drift
- [x] 2.4 In `GridCell.tsx`, drop the inline `width` so the track supplies it; keep `height: size` and the existing flex centring so the icon stays at tier size, centred
- [x] 2.5 In `GridCell.tsx`, render an inner `.grid-cell-surface` element sized exactly `iconSize × iconSize`, centred by the existing flex centring, to carry the highlight
- [x] 2.6 Move `background`/`border-radius` from `.grid-cell--occupied:hover` / `.grid-cell--over` onto the inner surface (e.g. `.grid-cell--over > .grid-cell-surface`), keeping the trigger classes on the outer cell so the hit area stays the full track while the paint stays an icon-sized square
- [x] 2.7 Confirm two adjacent occupied cells' highlights never touch — the gap and any distributed space stay unpainted
- [x] 2.8 Confirm hovering a cell's outer edge (distributed space, not the icon) still lights the centred square and shows the pointer cursor
- [x] 2.9 Update `src/newtab/components/Canvas.test.tsx` for the new column template, cell sizing, and highlight surface

## 3. Sidebar resize

- [x] 3.1 Confirm the canvas `ResizeObserver` fires on sidebar-driven width changes (not only window resize) and that capacity is recomputed from the new measurement
- [x] 3.2 Verify no clipping at any intermediate width during a continuous sidebar drag, including across a tier breakpoint — this is what `minmax(0, 1fr)` buys
- [x] 3.3 Confirm the change does not increase the number of `shouldReflowOnGrowth` crossings (and therefore storage writes) per sidebar drag versus today; record the finding, do not fix here

## 4. End-to-end coverage

- [x] 4.1 E2E: with a folder holding more bookmarks than one row, assert every icon's bounding box is fully inside the canvas's bounding box — right edge and bottom edge
- [x] 4.2 E2E: drag the sidebar wider past a column boundary, then re-assert full containment of every icon
- [x] 4.3 E2E: drag the sidebar narrower past a column boundary, then re-assert full containment of every icon
- [x] 4.4 E2E: drop a dragged bookmark onto the distributed space at a cell's edge (not on the icon) and assert it lands in that cell
- [x] 4.5 E2E: assert the hover highlight's rendered box is the tier icon size, not the cell's full width, on a canvas wide enough to have distributed space
- [x] 4.6 Guard against the known SW placement race when seeding fixture bookmarks — wait for placement before measuring or dragging

## 5. Verification

- [x] 5.1 `npm run typecheck`, `npm run lint`, unit tests, and e2e all green
- [x] 5.2 Manually reproduce the original report at 1918px window / 240px sidebar and confirm the right-most column is fully visible
- [ ] 5.3 Note the one-time icon reshuffle for existing users in the PR description
