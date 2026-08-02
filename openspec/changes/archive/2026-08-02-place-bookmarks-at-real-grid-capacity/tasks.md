## 1. Storage for the measured capacity

- [x] 1.1 Add `gridCapacity` to `StorageSchema` and `STORAGE_KEYS` in `src/lib/storage/schema.ts`, documented like `lastFolderId` (its own top-level key so writing it never read-modify-writes a record another writer shares) with a comment stating it is device-derived measurement, not a user setting, and is excluded from state export/import.
- [x] 1.2 Create `src/lib/storage/gridCapacity.ts` with a getter and setter, following `src/lib/storage/lastFolder.ts` as the shape precedent for a standalone global scalar. The getter SHALL return `undefined` (not a substituted default) when nothing has been measured, so callers decide the bootstrap.
- [x] 1.3 The accessor MUST NOT take `withPositionsLock`. It is a different storage key, and `placeNewBookmark` will call it from inside that lock — Web Locks are not reentrant (`src/lib/concurrency/positionsLock.ts:26-36`). Add a comment saying so; this is the constraint most likely to be broken later.
- [x] 1.4 Unit tests in `src/lib/storage/gridCapacity.test.ts`: round-trip, unmeasured returns `undefined`, last write wins.

## 2. Redefine the bootstrap default

- [x] 2.1 In `src/lib/grid/placement.ts:8`, keep `DEFAULT_GRID_CAPACITY = { cols: 6, rows: 4 }` and rewrite its comment. It currently promises "Group 4" wiring that never happened; it must now state that this is the bootstrap value used only until a new-tab page has measured a capacity, and point at `storage/gridCapacity.ts` for the real source.

## 3. Persist the measurement from the page

- [x] 3.1 In `src/newtab/hooks/useGridLayout.ts` (capacity is computed at `:133-136`), persist `capacity` whenever the measured value changes. Write only on change, not on every render.
- [x] 3.2 Verify the write cannot precede `dataLoaded` / a zero-sized measurement — `size.width === 0` must never be persisted as a capacity.
- [x] 3.3 Unit test the persistence trigger: a changed capacity writes, an unchanged one does not, a zero-size measurement does not.

## 4. Place against the measured capacity

- [x] 4.1 In `src/lib/bookmarks/events.ts:25-37`, make `placeNewBookmark` read the stored capacity and fall back to `DEFAULT_GRID_CAPACITY` when unmeasured. Keep the read inside the existing `withPositionsLock` section only if 1.3 holds; otherwise read before acquiring.
- [x] 4.2 In `src/lib/grid/seed.ts:23-26`, `backfillFolderPositions`'s `capacity` parameter keeps its explicit-argument behaviour (the page passes its measured value at `useGridLayout.ts:152`); change only the default used by the service-worker call path at `events.ts:135` so it resolves the stored capacity instead of the constant.
- [x] 4.3 Unit tests in `src/lib/bookmarks/events.test.ts`: with a stored 9x5, the 25th bookmark created in a folder lands on page 0 (not page 1); with nothing stored, placement matches today's 6x4 behaviour exactly.
- [x] 4.4 Confirm no deadlock: run the existing `src/lib/storage/positions.test.ts` and `src/lib/bookmarks/events.test.ts` suites. Note these use the `fallbackMutex` path since jsdom lacks Web Locks — a reentrancy deadlock will NOT surface here, only in e2e. Task 6.3 is the real check.

## 5. Confirm the state-transfer exclusion

- [x] 5.1 Verify `src/lib/transfer/exportState.ts` and `importState.ts` neither read nor write the new key. Expected to need no code change — the point is to confirm and to add a test so a later "export everything" refactor cannot silently include it.
- [x] 5.2 Add tests mirroring the existing last-opened-folder ones: export output contains no capacity value, and import leaves a recorded capacity untouched.

## 6. E2E — remove the workaround, add the regression test

- [x] 6.1 In `e2e/grid-fit.spec.ts:144-146`, remove the "capacity stays under the 24 cells the SW seeds per page" viewport constraint and its comment. Re-run the affected tests at an unconstrained viewport and fix any assertion that depended on the small grid.
- [x] 6.2 Add an e2e test asserting a canvas page fills **past** 24 cells: pick a viewport whose real capacity exceeds 24 under `src/lib/grid/sizing.ts`, seed more bookmarks than that capacity, and assert page 0's occupied-cell count equals the measured capacity. This is the direct regression test and is impossible to write today.
- [x] 6.3 This test is the only place a `withPositionsLock` reentrancy deadlock would surface (real Chromium takes the Web Locks path; Vitest does not). A hang here means task 1.3 was violated.
- [x] 6.4 Re-run `e2e/position-write-concurrency.spec.ts` and `e2e/cross-page-drag.spec.ts` — both encode assumptions about SW placement and are the most likely to be disturbed.

## 7. Verification

- [x] 7.1 `npm run typecheck && npm run lint && npm run format`
- [x] 7.2 `npm test`
- [x] 7.3 `npm run test:e2e`
- [x] 7.4 Discharged by the automated regression test (6.2) rather than a by-hand browser session: it drives a real Chromium at 1900x1000, seeds 70 bookmarks, and asserts page 0 fills to its measured capacity. Verified to FAIL when the fix is reverted (waitForFullPage never completes), so it genuinely covers the defect. No manual browser check was performed.
- [x] 7.5 Confirm the out-of-scope boundary held — no code path repacks positions stored before this change. Bookmarks stranded by a previous import are expected to stay stranded.

## 8. Follow-ups (not this change)

- [ ] 8.1 Decide sequencing against `rework-utab-import` Thread 3 (root-folder import entry point), which has no proposal yet and is the last unstarted sibling of this split.
- [ ] 8.2 Update the `e2e-page-fill-capacity-limit` project memory once this is archived — the ≤24-cell rule it records stops being true.
