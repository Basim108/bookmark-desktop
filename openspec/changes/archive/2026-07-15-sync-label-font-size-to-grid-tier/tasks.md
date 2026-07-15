## 1. Combined tier-resolution function

- [x] 1.1 In `src/lib/grid/sizing.ts`, replace `resolveTierIconSize(availableWidth): number` with a single function (e.g. `resolveTier(availableWidth): { iconSize: number; labelFontSize: string }`) returning both the tier's icon size (80/106/166) and its label font-size (`"0.75rem"`/`"0.85rem"`/`"1rem"`) together, keeping `MEDIUM_BREAKPOINT`/`LARGE_BREAKPOINT` unchanged.
- [x] 1.2 Update `src/lib/grid/sizing.test.ts` to test the new combined function's shape and values at the existing boundary cases (below/at 1660, below/at 2100).

## 2. Thread the resolved value through the hook and Canvas

- [x] 2.1 In `src/newtab/hooks/useGridLayout.ts`, update `computeCapacityAndIconSize` (or equivalent) to call the new combined function; keep `iconSize` behavior identical, and expose the resolved `labelFontSize` from the hook alongside it.
- [x] 2.2 In `src/newtab/components/Canvas.tsx`, add an `onLabelFontSizeChange` callback prop; call it (e.g. via a `useEffect` keyed on the resolved value) whenever the hook's `labelFontSize` changes.

## 3. Report the value up to App and set the CSS variable

- [x] 3.1 In `src/newtab/App.tsx`'s `AppContent`, add state for `labelFontSize` initialized to `"0.75rem"` (the smallest tier's value), pass a setter as `onLabelFontSizeChange` into `Canvas`, and apply the current value as an inline `--label-font-size` custom property on the `.app` div (alongside the existing `ref={appRef}`).

## 4. Apply the CSS variable to both label styles

- [x] 4.1 In `src/newtab/main.css`, replace `.bookmark-icon-label`'s hardcoded `font-size: 0.75rem` with `font-size: var(--label-font-size)`.
- [x] 4.2 Add a new `.folder-label { font-size: var(--label-font-size); }` rule (previously unstyled, inheriting the browser default). Do not touch `.folder-settings-panel`'s separate `0.75rem` rule.

## 5. Verification

- [x] 5.1 Run the test suite and confirm `sizing.test.ts` passes with the new function.
- [x] 5.2 Manually load the new-tab page at each of the three viewport-width tiers and confirm both folder names (sidebar) and bookmark names (canvas) change font-size together at the same breakpoints as the grid's icon size, and that resizing the sidebar alone (without crossing a grid breakpoint) does not change label font-size.
