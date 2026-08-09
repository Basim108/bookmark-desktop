## Why

A bookmark the user positioned by drag-and-drop does not reliably come back to
that position after the window is resized away and back. Growing the column
count runs a **dense repack that rewrites stored positions** (`grid/reflow.ts`),
collapsing the user's gaps and pushing a deliberately-placed bookmark to the end
of the pack; the original design justified this with "there's no requirement
protecting stored position during growth", which is false in the user's model.
Because the repack is gated on a per-tab, per-session baseline
(`previousCapacityRef`), whether the position survives depends on incidental
factors — a reload, a folder switch, a second tab at another size, momentarily
overshooting the width, collapsing the sidebar — which is why the loss is
intermittent.

The root problem is representational: a stored `(page, row, col)` has no meaning
without the capacity it was authored at, and that capacity is never recorded. So
"pull items forward when the grid gains cells" cannot be computed at render time,
and the original implementation had to mutate storage to express it.

## What Changes

- **BREAKING (storage shape, migrated automatically)** A bookmark's stored
  position becomes a **slot**: a single capacity-independent integer. Display
  position is derived per render as `indexToCell(slot, currentCapacity)`.
- Grid re-layout on window resize becomes a **pure reflow of the slot sequence**,
  like text rewrapping. Cells-per-page rises → later items pull forward, pages
  may collapse; cells-per-page falls → items push back, pages may be added. Empty
  slots reflow with the sequence and are preserved.
- **A window resize never writes to storage.** Stored slots change only on user
  action: drag, create, move-in, delete. Round-tripping any window size is the
  identity by construction, not by a heuristic.
- Removed: `repackPositions`, `shouldReflowOnGrowth`, `reflowFolderPositions`,
  the reflow effect and `previousCapacityRef` in `useGridLayout`.
- Removed: shrink displacement/compaction in `paginate`. Under slots every
  position always maps to a valid cell, so "doesn't fit" ceases to be a state and
  the displaced/compaction pass has nothing to act on.
- Placement ("next free cell") becomes "lowest free slot" and no longer needs a
  capacity, so the persisted measured-capacity mechanism
  (`storage/gridCapacity.ts`, `DEFAULT_GRID_CAPACITY`, capacity publishing) is no
  longer required by any placement path.
- One-time migration of existing `(page, row, col)` values to slots, performed
  once globally under the positions lock, framed on the last measured capacity.
- Export format gains a `slot` field per node while retaining the existing
  `position` object, so the format stays backward compatible: **minor** bump
  `1.0.0 → 1.1.0`, no major bump, existing backups still import.

## Capabilities

### New Capabilities

_None._ This change reshapes existing bookmark-canvas requirements rather than
introducing a new capability.

### Modified Capabilities

- `bookmark-canvas`: replaces `Column Growth Backfill`, `Row Growth Leaves Empty
  Cells`, `Grid Shrink Compaction and Cascade`, and `Pinned Position Resilience
  Under Shrink` with a single capacity-independent-slot reflow requirement;
  amends `Position Persistence` (exact reproduction now holds at every window
  size) and `Next-Free-Cell Placement` (capacity-free lowest-free-slot).
- `state-transfer`: `Id-Free, Versioned Export Format` gains the per-node `slot`
  field alongside `position`, and import prefers `slot` when present.

## Impact

- **Code**: `src/lib/grid/reflow.ts` (deleted), `src/lib/grid/layout.ts`
  (paginate reduced to a pure slot wrap), `src/lib/grid/placement.ts`
  (`getNextFreeSlot`), `src/lib/grid/seed.ts`, `src/lib/grid/dragDrop.ts`
  (display cell → slot at the write boundary), `src/lib/bookmarks/events.ts`,
  `src/lib/storage/positions.ts`, `src/lib/storage/schema.ts`,
  `src/lib/storage/gridCapacity.ts` (no longer required by placement),
  `src/newtab/hooks/useGridLayout.ts`, `src/lib/transfer/{exportState,importState,version}.ts`.
- **Stored data**: the `positions` key changes shape; migration is required and
  irreversible for older builds reading the same profile.
- **Export files**: `1.1.0`; older `1.0.0` files remain importable.
- **Supersedes in part**: `2026-08-02-place-bookmarks-at-real-grid-capacity` —
  the bug it fixed (a context placing against a capacity the canvas does not
  render at) becomes structurally impossible rather than kept-in-sync.
- **Tests**: unit suites for `reflow` (removed), `layout`, `placement`, `seed`,
  `dragDrop`, `positions`, `useGridLayout`; new e2e covering a resize round trip,
  which no current e2e exercises.
