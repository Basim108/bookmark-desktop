## 1. Full-layout drop resolution

- [x] 1.1 Change `resolveDrop` (`src/lib/grid/dragDrop.ts`) to look up the active entry across the full folder layout, while matching the occupant on the target cell's page; keep authoritative-overwrite and swap semantics
- [x] 1.2 Update `Canvas.tsx` `onDragEnd` to pass the full layout (all pages' entries) into `resolveDrop` instead of the displayed `page`
- [x] 1.3 Add unit tests to `dragDrop.test.ts` for cross-page move to an empty cell and cross-page swap with an occupant (source page ≠ target page)

## 2. Drag overlay so the icon survives page flips

- [x] 2.1 Add `onDragStart` + active-drag state (id + data needed to render) at the `DndContext` in `App.tsx`, clearing it on `onDragEnd`/`onDragCancel`
- [x] 2.2 Render the dragged `BookmarkIcon` inside a `<DragOverlay>`, reusing the icon's presentation so the overlay matches the in-grid icon (size, label, custom icon)
- [x] 2.3 Present the in-grid source cell appropriately while dragging (empty gap or dimmed in place) so the overlay is the single visible dragged element
- [x] 2.4 Verify the drag no longer reverts when the page auto-advances mid-drag (manual + covered by e2e in section 5)

## 3. Continuous multi-page edge advance

- [x] 3.1 Update `useEdgePagination` to re-arm the hold timer after each advance while the icon stays at the same edge, halting when no further page exists in that direction
- [x] 3.2 Wire `Canvas.tsx` so the hook knows whether a further advance is possible (`canGoNext`/`canGoPrev`) in the held direction
- [x] 3.3 Add/extend `useEdgePagination.test.ts`: chained advance across multiple pages, and stop at first/last page; leaving the edge cancels a pending advance

## 4. Cross-tab sync check

- [x] 4.1 Confirm a cross-page move persists stored positions through the existing Layout Change Propagation path (no new broadcast code); add coverage if a gap is found

## 5. End-to-end verification

- [x] 5.1 Add e2e tests under `e2e/` for: (a) traversing multiple pages in one drag — grab on page 1, hold at the right edge past page 2, drop on page 3, assert it persists there; and (b) cross-page swap — drag from page 1 onto an occupied cell on page 2, assert the dragged bookmark lands on page 2 and the displaced bookmark moves to page 1's origin cell
- [x] 5.2 Run `openspec validate fix-cross-page-drag --strict`, the unit suite, and the e2e suite; confirm all green
