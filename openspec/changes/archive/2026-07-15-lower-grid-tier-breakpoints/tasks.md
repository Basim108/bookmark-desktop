## 1. Breakpoint constants

- [x] 1.1 In `src/lib/grid/sizing.ts`, change `MEDIUM_BREAKPOINT` from `1660` to `512` and `LARGE_BREAKPOINT` from `2100` to `1024`. Leave `SMALL_ICON_SIZE`/`MEDIUM_ICON_SIZE`/`LARGE_ICON_SIZE` and the three label font-size constants unchanged.

## 2. Test updates

- [x] 2.1 In `src/lib/grid/sizing.test.ts`, update the `resolveTier` boundary-case assertions from 1659/1660/2099/2100 to 511/512/1023/1024.
- [x] 2.2 In `src/newtab/components/Canvas.test.tsx`, update the two tier-specific tests ("sizes cells at the 106px tier...", "sizes cells at the 166px tier...") to resize to widths inside the new 512–1024 (medium) and ≥1024 (large) ranges instead of the old 1660–2100 range, recomputing expected cell counts accordingly.

## 3. Verification

- [x] 3.1 Run the test suite and confirm all tests pass with the new breakpoints.
- [x] 3.2 Manually load the new-tab page at canvas widths spanning below 512px, between 512–1024px, and at/above 1024px, and confirm grid cell size, bookmark label size, and folder label size all switch tiers together at the new thresholds.
