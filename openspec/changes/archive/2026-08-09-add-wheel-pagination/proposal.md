## Why

Turning a canvas page requires clicking the `‹`/`›` pagination buttons — the
only pointer-driven way to page, and it forces a round trip to a small fixed
target at the bottom of the canvas. Performance mice expose a dedicated
horizontal (thumb) wheel, and a paginated carousel is exactly the surface it
exists to drive. Horizontal wheel input over the canvas is currently dead: no
`wheel` listener exists anywhere in the codebase.

## What Changes

- Turn canvas pages with horizontal wheel input (`deltaX`) over the canvas: a
  scroll right advances to the next page, a scroll left returns to the
  previous one. Paging halts at the first and last page.
- Normalize wheel deltas across `deltaMode` (pixel / line / page) so the
  gesture behaves identically in browsers that report line-based deltas
  (Firefox) and pixel-based deltas (Chrome).
- Rate-limit page turns so a single thumbwheel detent turns exactly one page,
  a sustained roll pages at a readable cadence, and a high-magnitude burst
  cannot bank credit for future turns.
- Suppress wheel paging entirely while a bookmark drag is in progress, so the
  existing drag-to-edge auto-advance remains the sole paging mechanism during
  a drag.
- Prevent the browser's default horizontal-overscroll handling on the canvas,
  so paging cannot trigger back/forward history navigation away from the
  new-tab page.
- Vertical wheel input (`deltaY`) is explicitly **not** mapped to paging.

## Capabilities

### New Capabilities
<!-- None; this extends existing canvas pagination behavior. -->

### Modified Capabilities

- `bookmark-canvas`: gains a new **Horizontal Wheel Pagination** requirement
  covering direction mapping, the one-detent-one-page guarantee, bounds,
  cross-browser delta units, suppression during drag, and non-interference
  with the browser's history navigation. This follows the existing spec's
  precedent of giving each paging input its own requirement (**Drag-to-Edge
  Pagination** is already separate from **Grid Pagination**); no existing
  requirement's behavior changes.

## Impact

- `src/newtab/hooks/useWheelPagination.ts` (new) — delta normalization and the
  accumulate/threshold/cooldown state machine, mirroring the shape of the
  existing `useEdgePagination.ts` (a pure exported function plus a hook that
  owns timing state in refs).
- `src/newtab/hooks/useWheelPagination.test.ts` (new) — unit coverage
  mirroring `useEdgePagination.test.ts`: the pure normalizer tested directly,
  the hook tested against fake timers.
- `src/newtab/components/Canvas.tsx` — register a **non-passive** `wheel`
  listener on `containerRef` in an effect and route turns through the existing
  `setCurrentPage`. React's `onWheel` prop cannot be used: React registers
  wheel listeners as passive at the root, which makes `preventDefault()` a
  no-op. Gate on the active drag already available from `useDndContext()`.
- `openspec/specs/bookmark-canvas/spec.md` — gains the **Horizontal Wheel
  Pagination** requirement (delivered as a delta spec under this change).
- `e2e/canvas-navigation.spec.ts` — wheel-driven page turn coverage alongside
  the existing button-driven navigation specs.
- No new dependencies. No storage-format or persisted-state change: paging is
  display state (`pageSelection` in `useGridLayout`), and this change adds an
  input path to it rather than altering what is stored.
