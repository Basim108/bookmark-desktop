## 1. Slot Primitives

- [x] 1.1 Add a `Slot` type and `slotToCell` / `cellToSlot` in `lib/grid/placement.ts`, expressed over `cellsPerPage = cols × rows` (the existing `indexToCell` / `cellToIndex` are already this function — rename and make the naming reflect that a slot is stored and a cell is derived)
- [x] 1.2 Add `getNextFreeSlot(occupied: number[]): number` returning the lowest non-negative integer not in `occupied`; unit-test that it fills an earlier gap before extending past the last slot
- [x] 1.3 Unit-test that `slotToCell` is total (every slot yields `row < rows` and `col < cols` at any capacity) and that `cellToSlot ∘ slotToCell` is the identity

## 2. Storage Shape and Migration

- [x] 2.1 Change `FolderPositions` in `lib/storage/schema.ts` to map bookmark id → slot integer, and add a positions-schema marker to the store
- [x] 2.2 Implement the one-time cell → slot conversion: under `withPositionsLock`, if the marker is absent, resolve the frame capacity (`GRID_CAPACITY`, else `6×4`), convert every folder via `cellToSlot`, write slots plus the marker
- [x] 2.3 Unit-test the migration: converts against the last measured capacity, reproduces the pre-migration layout at that capacity, is idempotent, and a second caller observes the marker instead of re-converting
- [x] 2.4 Update `lib/storage/positions.ts` signatures (`setBookmarkPosition`, `setBookmarkPositions`, `replaceAllPositions`) to carry slots; the lock structure and the locked/unlocked split are unchanged

## 3. Display Path

- [x] 3.1 Rewrite `paginate` in `lib/grid/layout.ts` as a pure slot wrap: bucket by `floor(slot / cellsPerPage)`, derive each cell, sort within page. Delete `fitsCapacity`, the displaced list, and the compaction/cascade pass
- [x] 3.2 Ensure page count derives from the highest occupied slot, so a trailing page collapses when capacity grows enough to absorb it
- [x] 3.3 Unit-test `paginate` against the three-capacity worked example in `design.md` (3, 4 and 6 cells per page over slots 0,1,2,3,␣,5), including the collapse to a single page
- [x] 3.4 Unit-test that reading order is preserved at every capacity, covering the case that today's compaction scrambles (12 items authored at 6 columns, viewed at 4)

## 4. Remove the Resize Mutation

- [x] 4.1 Delete `lib/grid/reflow.ts` and `lib/grid/reflow.test.ts`
- [x] 4.2 Delete `previousCapacityRef` and the reflow effect from `newtab/hooks/useGridLayout.ts`, keeping the first-run backfill (which fills missing positions only, and is not resize-triggered)
- [x] 4.3 Add a `useGridLayout` test asserting that a capacity change alone performs no write to the positions key

## 5. Write Path

- [x] 5.1 Convert the resolved drop cell to a slot at the storage boundary in `newtab/hooks/useGridLayout.ts` / `lib/grid/dragDrop.ts`; `resolveDrop` keeps resolving against the displayed layout across all pages
- [x] 5.2 Verify swap semantics carry the other item's previous slot, same-page and cross-page
- [x] 5.3 Update `lib/grid/seed.ts` and `lib/bookmarks/events.ts` to place via `getNextFreeSlot`, dropping the capacity argument and the `getMeasuredGridCapacity` / `DEFAULT_GRID_CAPACITY` reads
- [x] 5.4 Retire the capacity-publishing effect in `useGridLayout` and decide the fate of `lib/storage/gridCapacity.ts` per the open question in `design.md` (delete the key, or leave it unread) — the migration in 2.2 is its last consumer

## 6. Export / Import

- [x] 6.1 Emit `slot` on each bookmark node in `lib/transfer/exportState.ts`, retaining `position` derived at the fixed reference capacity chosen in `design.md`'s open question
- [x] 6.2 Make `lib/transfer/importState.ts` prefer `slot` and fall back to converting `position` at that same reference capacity
- [x] 6.3 Bump `EXPORT_FORMAT_VERSION` to `1.1.0` — minor only; confirm the major-version compatibility gate still accepts `1.0.0` files
- [x] 6.4 Unit-test round-tripping a `1.1.0` file, importing a `1.0.0` file, and `slot` winning when both fields are present

## 7. End-to-End Coverage

- [x] 7.1 New e2e: drag a bookmark to a specific cell, resize the window away and back, assert it returns to that exact cell — the reported bug, currently uncovered by any e2e
- [x] 7.2 E2e variants that previously turned the round trip lossy: reload at the other size; switch folders and back; resize past a larger width before returning; collapse and restore the sidebar
- [x] 7.3 E2e: a second new-tab page open at a different size does not disturb the first page's layout
- [x] 7.4 E2e: an empty cell between bookmarks survives a resize round trip and reflows with the sequence

## 8. Spec and Documentation Sync

- [x] 8.1 Run `openspec validate store-bookmark-positions-as-slots --strict` and resolve any findings
- [x] 8.2 Update `openspec/project.md`'s description line — "Icon position (page/row/col) persists per item" is no longer accurate
- [x] 8.3 Re-read the module header comments in `lib/storage/positions.ts`, `lib/grid/layout.ts`, `lib/grid/seed.ts` and `lib/grid/placement.ts`; several document the removed shrink/growth asymmetry and must not be left describing behaviour that no longer exists
