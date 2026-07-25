## Context

The canvas paginates a folder's bookmarks into a carousel and already ships
the machinery for drag-to-edge auto-advance:

- `useEdgePagination` (`src/newtab/hooks/useEdgePagination.ts`) — detects when a
  dragged rect is within a threshold of the left/right canvas edge and, after a
  hold delay (600ms), calls `onAdvance`.
- `Canvas.tsx` wires `onDragMove` to feed the edge hook and, on `onDragEnd`,
  calls `resolveDrop(activeId, targetCell, page)`.
- `resolveDrop` (`src/lib/grid/dragDrop.ts`) computes the stored-position
  updates for a drop.

Only the **current page** is mounted at a time (`page = pages[currentPage]`),
and there is **no `DragOverlay`** — the dragged element is the actual
`BookmarkIcon` DOM node inside a `GridCell` on the current page. `@dnd-kit`
translates that real node during the drag.

Two structural facts combine to break cross-page drag, both confirmed by
reproduction:

1. **The dragged node lives on the page being left.** When auto-advance calls
   `setCurrentPage(n+1)`, page `n` unmounts — and with it the very node being
   dragged. The pointer loses the icon; `@dnd-kit` ends the gesture against the
   origin, so the bookmark reverts to its starting page.
2. **`resolveDrop` only sees the displayed page.** Even if the node survived,
   after advancing, `page` is the destination page's entries. The dragged
   bookmark still lives on the origin page, so
   `activeEntry = displayedPage.find(e => e.bookmarkId === activeId)` is
   `undefined` and the function returns `[]` (the "missing" branch tested at
   `dragDrop.test.ts:34`). No update persists.

Separately, `useEdgePagination` advances only **one page per edge-entry**: once
the timer fires it does not re-arm while the icon stays at the same edge, so the
user cannot chain to page 3+ without pulling back to center first.

## Goals / Non-Goals

**Goals:**
- A bookmark grabbed on any page can be dropped onto any cell on any other page
  and persist there (empty-cell move and occupied-cell swap, cross-page).
- The dragged icon stays attached to the pointer across auto-advance page flips.
- Drag-to-edge advances continuously across successive pages while held at an
  edge, halting at the first/last page.
- Cross-page behavior is covered by unit tests (`resolveDrop`,
  `useEdgePagination`) and at least one e2e flow.

**Non-Goals:**
- Rendering multiple pages simultaneously or a visible page-peek/animation.
- Changing the hold delay, edge threshold, or the visual carousel transition.
- Reworking cross-folder drag (bookmark → sidebar folder), which is resolved
  separately in `App.tsx` and is unaffected.

## Decisions

### Decision 1: Keep every page mounted + a `DragOverlay`, and re-measure on page change

The dragged icon is lost on a page flip for two compounding reasons, and the
fix addresses both:

1. **The dragged node unmounts.** We render only the current page, so a
   drag-to-edge advance unmounts the source page — and with it the active
   `useDraggable` node. dnd-kit then loses pointer tracking entirely (neither
   `onDragEnd` nor `onDragCancel` fires) and the drop reverts to origin. A
   `<DragOverlay>` alone does **not** fix this: the overlay is only a visual;
   the underlying draggable registration still dies when its node unmounts.
   **Fix:** render *all* pages, showing only the current one (`display: none`
   on the rest). The source page is hidden, not unmounted, so the dragged node
   survives the flip. Because every page's grid is mounted at once, cell
   droppable ids are **page-qualified** (`page-row-col`) to avoid collisions —
   which also lets a cross-page drop read its destination page straight off the
   cell it landed on (removing any reliance on the live `currentPage`).
2. **The destination page's cells aren't measured.** dnd-kit measures
   droppables at drag start; the just-shown page's cells (hidden at drag start)
   have stale/zero rects, so a drop resolves to no cell. `MeasuringStrategy.Always`
   does not help because it only re-measures on `DndContext`-level renders, and
   `currentPage` lives in a descendant. **Fix:** call
   `useDndContext().measureDroppableContainers([])` from a `useEffect` keyed on
   `currentPage`, forcing a re-measure the moment a page becomes visible.

The `<DragOverlay>` (tracked via `onDragStart`/cleared on end/cancel, rendered
by a `DraggedBookmarkOverlay` that reuses the shared `BookmarkIconContent`)
supplies the moving visual detached from the grid; the in-grid source icon
stays as a dimmed ghost.

- **Placement:** the overlay, active-drag state, and re-measure live in
  `Canvas` (not `App` as first sketched) because that is the only place with
  `iconSize` and the full `bookmarksById` map — and it is already inside the
  `DndContext`, so `useDndContext()`/`DragOverlay` work there.
- **Alternative considered — DragOverlay only, keep rendering just the current
  page:** insufficient; the drag still cancels when the source node unmounts
  (verified during implementation). Rejected.
- **Alternative considered — a persistent hidden draggable for just the active
  item:** moving the item's node from the grid into a persistent container is
  an unmount+remount, so dnd-kit still loses the original node. Rejected.
- **Trade-off:** mounting every page mounts every bookmark's icon (favicon +
  settings hooks) up-front rather than per page. Acceptable for a folder's
  direct children; revisit if very large folders show a cost.

### Decision 2: Resolve drops against the full layout, not the displayed page

Change `resolveDrop` so the **active entry** is looked up across all pages
(the full `LayoutCell[]` for the folder), while the **occupant** at the target
cell is looked up on the target/displayed page. Canvas passes the full layout
in. The existing swap logic then produces the correct cross-page result with no
special-casing: active → target cell (destination page); occupant →
active's original cell (origin page).

- **Why:** The drop's source and destination can now be on different pages;
  scoping the active lookup to the displayed page is exactly the bug.
- **Signature:** `resolveDrop(activeId, targetCell, layout)` where `layout` is
  the folder's full entry list. Occupant match keys on `targetCell`'s
  page/row/col, which already carries the destination page (`currentPage` at
  drop time). Keep the "authoritative drag overwrites stored position"
  semantics unchanged.
- **Alternative considered — a separate `resolveCrossPageDrop`:** Duplicates
  swap logic and invites drift between the two paths. Rejected in favor of one
  unified function.

### Decision 3: Continuous multi-page advance in `useEdgePagination`

After `onAdvance` fires while the icon is still held at the edge, re-arm the
hold timer for the next advance instead of latching. Stop when the consumer
signals there is no further page in that direction.

- **Mechanism:** `onAdvance` (or a companion predicate) reports whether a
  further advance is possible; if so, schedule the next timer, otherwise idle
  until the edge state changes. The caller (`Canvas`) already knows `canGoNext`
  / `canGoPrev`, so pass that knowledge in (e.g. `onAdvance` returns a boolean
  "advanced / can advance again", or the hook is given a `canAdvance(direction)`
  callback).
- **Why:** Matches the user's expectation and standard launcher behavior
  (iOS/Launchpad), where holding at the edge pages through repeatedly.
- **Alternative considered — leave single-advance, require re-entry:** Simpler
  but fails the stated need to chain to page 3+. Rejected.

## Risks / Trade-offs

- **[Droppable rect staleness after page flip]** `@dnd-kit` measures droppables
  at drag start; the destination page mounts fresh cells mid-drag. → Cells are
  keyed by `row-col` and occupy identical screen geometry on every page, so
  cached rects remain valid; if `over` proves unreliable in practice, set
  `measuring.droppable.strategy` to `WhileDragging` on the `DndContext`.
- **[Overlay visual divergence]** The overlay must visually match the in-grid
  icon (size, label, custom icon). → Reuse `BookmarkIcon` (or its inner
  presentational part) inside the overlay so there is a single source of truth.
- **[Auto-advance feels too fast/aggressive when chained]** Continuous paging
  could overshoot. → Keep the existing 600ms hold as the per-advance cadence;
  leaving the edge cancels immediately, giving the user a natural brake.
- **[Live cross-tab sync]** Cross-page moves persist stored positions like any
  drag, so the existing broadcast path (Layout Change Propagation) applies
  unchanged; verify a cross-page move reflects in a second open tab.

## Open Questions

- Should the in-grid source cell show an empty gap (placeholder) while dragging
  via the overlay, or keep the icon dimmed in place until drop? Leaning toward a
  gap for clarity, but either is acceptable and can be decided during
  implementation.
