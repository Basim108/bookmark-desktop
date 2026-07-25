## Why

Dragging a bookmark from one page and dropping it onto another page is
effectively impossible today. The drag-to-edge auto-advance flips the page
after a 600ms hold, but at that moment the dragged icon is lost — the pointer
stops holding it and the bookmark snaps back to its original page. Users
cannot reorganize bookmarks across pages, which is a core expectation of a
paginated carousel.

## What Changes

- Fix cross-page drag so a bookmark grabbed on one page can be dropped onto a
  target cell on any other page, persisting to its new position.
- Introduce a drag overlay so the dragged icon's visual is detached from the
  currently mounted page and survives auto-advance page flips (root cause of
  the "lost draggable" symptom).
- Resolve the drop against the full folder layout (all pages) rather than only
  the currently displayed page, so the moved bookmark and any swap target are
  found regardless of which page each lives on.
- Extend drag-to-edge pagination to advance continuously across multiple pages
  while the icon is held at the edge (page 2 → 3 → 4 …), instead of advancing
  only one page per edge-entry, halting at the first/last page.

## Capabilities

### New Capabilities
<!-- None; this modifies existing canvas drag/pagination behavior. -->

### Modified Capabilities
- `bookmark-canvas`: The **Drag-to-Edge Pagination** and **Manual Drag
  Repositioning** requirements change. Drag-to-edge pagination must advance
  continuously across pages while held at an edge, and a bookmark dropped after
  a cross-page advance must land and persist on the destination page (including
  swapping with an occupant already there).

## Impact

- `src/newtab/App.tsx` — add a `DragOverlay` (with `onDragStart`/active-id
  state) at the `DndContext` level so the dragged icon renders detached from
  the page grid.
- `src/lib/grid/dragDrop.ts` (`resolveDrop`) — source the active bookmark's
  entry (and enable cross-page swaps) from the full layout, not just the
  displayed page; add cross-page test coverage (gap at `dragDrop.test.ts:34`).
- `src/newtab/hooks/useEdgePagination.ts` — re-arm the hold timer after each
  advance for continuous multi-page paging; stop at page bounds.
- `src/newtab/components/Canvas.tsx` — pass the full layout into `resolveDrop`;
  keep feeding `onDragMove` rects to edge pagination.
- No new dependencies; `@dnd-kit/core` already provides `DragOverlay`.
- e2e coverage under `e2e/` for the cross-page drag flow.
