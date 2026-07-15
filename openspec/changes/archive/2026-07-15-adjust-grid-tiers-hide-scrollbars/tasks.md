## 1. Grid tier constants

- [x] 1.1 In `src/lib/grid/sizing.ts`, update `SMALL_ICON_SIZE` from `48` to `80`, `MEDIUM_ICON_SIZE` from `63` to `106`, and `LARGE_ICON_SIZE` from `100` to `166`. Leave `MEDIUM_BREAKPOINT` (1660) and `LARGE_BREAKPOINT` (2100) unchanged.
- [x] 1.2 Update `src/lib/grid/sizing.test.ts` assertions that hardcode the old 48/63/100 tier values to the new 80/106/166 values, keeping the same breakpoint boundary cases (e.g. `1659`, `1660`, `2099`, `2100`).

## 2. Canvas scrollbar hiding

- [x] 2.1 In `src/newtab/main.css`, add `scrollbar-width: none;` to `.canvas-grid` and a new `.canvas-grid::-webkit-scrollbar { display: none; }` rule, mirroring the existing `.sidebar-scroll-area` scrollbar-hiding pattern. Keep `overflow: auto` as-is.

## 3. Verification

- [x] 3.1 Run the test suite and confirm `sizing.test.ts` passes with the updated values.
- [x] 3.2 Manually load the new-tab page at each of the three viewport-width tiers and confirm bookmark icons visibly render larger than before, grid capacity (cols/rows) is still consistent with floor(availableWidth/cellSize), and no native scrollbar is visible on the canvas even when a folder's content would overflow.
