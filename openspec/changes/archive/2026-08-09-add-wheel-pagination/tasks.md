## 1. Wheel delta normalization

- [x] 1.1 Create `src/newtab/hooks/useWheelPagination.ts` exporting a pure `normalizeWheelDeltaX({ deltaX, deltaMode }, containerWidth)` that maps `DOM_DELTA_PIXEL` through unchanged, `DOM_DELTA_LINE` through a `× LINE_HEIGHT_PX` (16) constant, and `DOM_DELTA_PAGE` through `× containerWidth`; export the constant for tuning
- [x] 1.2 Add `src/newtab/hooks/useWheelPagination.test.ts` covering the three delta modes, mirroring how `useEdgePagination.test.ts` tests `computeEdgeDirection` directly

## 2. Accumulate / threshold / cooldown state machine

- [x] 2.1 Implement the turn decision as a pure function of `(normalizedDelta, accumulator, now, lastTurnAt, { thresholdPx, cooldownMs })` returning the next accumulator, the next `lastTurnAt`, and the direction to turn (or none) — so the whole rule tests without a DOM
- [x] 2.2 Reset the accumulator to zero when the incoming delta's sign opposes it, so a direction reversal takes effect immediately
- [x] 2.3 Clamp `|accumulator|` to `thresholdPx` when the threshold is met but the cooldown has not elapsed, so a high-magnitude burst banks no credit for future turns (the load-bearing rule — see design.md Decision 2)
- [x] 2.4 Wrap the pure rule in a `useWheelPagination(onTurn, { thresholdPx, cooldownMs })` hook holding accumulator and `lastTurnAt` in refs, returning `{ handleWheel, reset }`; call the latest `onTurn` through a ref the way `useEdgePagination` does, so a turn-triggered re-render does not leave a stale closure
- [x] 2.5 Defaults `thresholdPx: 50`, `cooldownMs: 250`; tests pass both explicitly rather than relying on the defaults
- [x] 2.6 Extend the unit tests: one detent turns exactly one page; a sustained stream turns pages at the cooldown cadence; a single burst many times the threshold turns one page and turns no more once input stops; reversal is immediate; `deltaY`-only events are ignored

## 3. Canvas wiring

- [x] 3.1 In `Canvas.tsx`, register the handler on `containerRef.current` inside an effect via `addEventListener("wheel", handler, { passive: false })` with matching teardown — NOT React's `onWheel`, which is passive at the root and would make `preventDefault()` a silent no-op (design.md Decision 5)
- [x] 3.2 Call `preventDefault()` on every horizontal wheel event over the canvas, including when no page change results (bounds, single-page folder, suppressed during drag), so browser history navigation can never fire
- [x] 3.3 Route turns through the existing `setCurrentPage`, respecting `canGoPrev`/`canGoNext` so paging halts at the bounds
- [x] 3.4 Gate the handler on the active drag from the `useDndContext()` value `Canvas` already consumes, so wheel input is ignored while a bookmark is being dragged; call `reset()` when a drag starts
- [x] 3.5 Ignore events whose horizontal component is zero, leaving vertical wheel input untouched and un-prevented

## 4. Component-level coverage

- [x] 4.1 Extend `src/newtab/components/Canvas.test.tsx`: dispatching a horizontal wheel over the canvas changes the displayed page; a vertical wheel does not; a wheel at the last/first page does not wrap
- [x] 4.2 Assert the listener is registered non-passive and that `preventDefault` is called, so a regression to React's `onWheel` fails a test rather than only showing up as a stray browser navigation

## 5. End-to-end verification

- [x] 5.1 Add wheel-driven page turn coverage to `e2e/canvas-navigation.spec.ts` alongside the existing button-driven navigation specs, including an assertion that the new-tab page did not navigate away (the failure mode `preventDefault` guards)
- [x] 5.2 Confirm wheel input during a drag does not change the page, complementing the existing drag-to-edge specs
- [x] 5.3 Run `openspec validate add-wheel-pagination --strict`, the unit suite, and the e2e suite; confirm all green
