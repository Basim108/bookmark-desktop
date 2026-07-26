## 1. Cross-context lock

- [x] 1.1 Add `src/lib/concurrency/positionsLock.ts` exporting `withPositionsLock(fn)`, backed by `navigator.locks.request` under one named lock
- [x] 1.2 Fall back to a module-level `createMutex()` when `navigator.locks` is unavailable (jsdom), so unit tests keep single-context serialization instead of silently losing it
- [x] 1.3 Unit-test the helper: serializes overlapping callers, releases on throw, and propagates both results and rejections

## 2. Positions store

- [x] 2.1 Split `src/lib/storage/positions.ts` into lock-free internals (`readAllPositionsUnlocked` / `writeAllPositionsUnlocked`) and locked public operations
- [x] 2.2 Acquire the lock in `setFolderPositions`, `setBookmarkPosition`, `setBookmarkPositions`, `removeBookmarkPosition`, and `replaceAllPositions`
- [x] 2.3 Verify no locked function calls another locked function — Web Locks are not reentrant and would deadlock
- [x] 2.4 Document the `Unlocked` internals as callable only from inside a held lock

## 3. Composite read-then-write operations

- [x] 3.1 `placeNewBookmark` (`src/lib/bookmarks/events.ts`): hold the lock across reading positions, choosing the next free cell, and storing it — closing the separate bug where two bookmarks could be handed the same cell
- [x] 3.2 `backfillFolderPositions` (`src/lib/grid/seed.ts`): hold the lock across its read and its write
- [x] 3.3 `reflowFolderPositions` (`src/lib/grid/reflow.ts`): hold the lock across its read and its write
- [x] 3.4 Confirm the retained in-process `mutex` cannot deadlock against the new lock (SW takes mutex → lock; page takes lock only, never the mutex)

## 4. Verification

- [x] 4.1 `e2e/position-write-concurrency.spec.ts` passes — both the initial-backfill case and the cross-folder case
- [x] 4.2 Confirm the new e2e fails without the fix and passes with it, and is not merely timing-lucky (repeat the run)
- [x] 4.3 Confirm placements are no longer lost when creating in bulk from the page, matching the reproduction that opened this change
- [x] 4.4 `npm run typecheck`, `npm run lint`, `npm run format`, unit tests, and the full e2e suite all green
