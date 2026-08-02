## Why

The background service worker places every newly created bookmark against the
hardcoded `DEFAULT_GRID_CAPACITY` of 6x4 (`src/lib/grid/placement.ts:8`), while
the new-tab page renders at the capacity it actually measures — roughly 9x5 on a
typical window. The 25th bookmark added to a folder therefore gets stored as
`page 1, row 0, col 0` and appears on page 2, leaving ~21 visible cells on page 1
permanently empty.

This is not an import bug. It affects **every** creation path — Chrome's star
button, bookmarks arriving via sync, programmatic creates — and a bulk uTab
import only makes it obvious by creating hundreds of bookmarks at once. The
E2E suite already works around it: `e2e/grid-fit.spec.ts:144-146` deliberately
constrains a viewport so "a page's capacity stays under the 24 cells the SW
seeds per page", which means the suite currently cannot assert that a page fills.

Now, because the sibling change adding a root-folder import entry point
(`rework-utab-import`, Thread 3) makes imports easier to perform, and every
import hits this bug. Shipping that entry point first would make the defect more
visible, not less.

## What Changes

- The new-tab page SHALL persist the grid capacity it measures to a new global
  `chrome.storage.local` key, so the service worker can read it.
- `placeNewBookmark` (`src/lib/bookmarks/events.ts:25`) and
  `backfillFolderPositions` (`src/lib/grid/seed.ts:23`) SHALL place against that
  stored capacity instead of the 6x4 constant.
- `DEFAULT_GRID_CAPACITY` SHALL be retained and **redefined** as the bootstrap
  value used only when no page has ever measured a capacity — on a fresh profile
  the service worker can receive `onCreated` before any new-tab page has
  rendered. Its comment (which currently promises wiring that never happened)
  is rewritten to state this.
- Capacity SHALL be stored as a single **global** value, not per folder. It
  derives purely from canvas geometry (window size minus sidebar width), which
  no folder can vary today.
- The stored value SHALL be **last-measured-wins**. Two new-tab pages at
  different window sizes will overwrite each other; the most recent measurement
  is authoritative and no reconciliation is attempted.
- The stored capacity SHALL be excluded from state export/import, matching the
  precedent set by `lastFolderId` (`src/lib/storage/schema.ts:63-71`): it is
  device-derived state, not a setting the user configured, and restoring one
  machine's capacity onto another would reintroduce exactly this defect.
- The E2E workaround SHALL be removed and replaced with a test that asserts a
  canvas page fills **beyond** 24 cells at a viewport whose real capacity exceeds
  24.
- Positions written before this change are **not** repaired. Bookmarks already
  stranded on page 2 by a past import stay where they are; the remedy is to
  delete and re-import. Scoped out deliberately — see Design.

### Not doing

- **No inline placement by the importer.** An alternative considered was having
  the uTab importer write positions itself while the service worker stands down
  via the existing `transfer:setLock` mechanism (`events.ts:82-123`). Its main
  justification was a placement race that `make-position-writes-atomic`
  (archived 2026-07-26) already fixed with a cross-context lock. What remains
  would fix only the import path, leave Chrome-star bookmarking broken, create a
  second placement authority to keep in sync, and require amending
  `bookmark-import`'s "the importer does not write positions itself". Dropped.
- **No per-folder capacity**, and no relaxation of the "unmeasured" fallback into
  a guess based on stored positions.

## Capabilities

### New Capabilities

None. This wires an existing capability to a value it should always have used.

### Modified Capabilities

- `bookmark-canvas`: the **Next-Free-Cell Placement** requirement gains the
  capacity that "next free cell" is computed against — the most recently
  measured page capacity, with a documented bootstrap default when none has ever
  been measured. Today the requirement is silent on this, which is why two
  contexts could disagree without violating it.
- `state-transfer`: the **Export Entire Extension State to a JSON File**
  requirement gains an explicit exclusion for the stored measured capacity,
  mirroring the existing "SHALL NOT contain the last opened folder" clause and
  its rationale.

## Impact

**Code**

- `src/lib/storage/schema.ts` — new key in `StorageSchema` + `STORAGE_KEYS`.
- New storage accessor module for the capacity key (following `lastFolder.ts`
  as the shape precedent for a standalone global scalar).
- `src/lib/grid/placement.ts` — `DEFAULT_GRID_CAPACITY` semantics and comment.
- `src/lib/bookmarks/events.ts:25-37` — `placeNewBookmark` reads stored capacity.
- `src/lib/grid/seed.ts:23-26` — `backfillFolderPositions` default parameter.
- `src/newtab/hooks/useGridLayout.ts:133-169` — persist measured capacity.
- `src/lib/transfer/exportState.ts` / `importState.ts` — confirm exclusion (no
  change expected; the key is simply never added).

**Tests**

- `e2e/grid-fit.spec.ts:144-146` — remove the sub-24-cell viewport constraint and
  its explanatory comment.
- New E2E coverage for a page filling past 24 cells.
- Unit coverage for the bootstrap path (no stored capacity → 6x4) and for the
  service worker reading a stored capacity.

**Concurrency**

The capacity read happens inside `placeNewBookmark`, which runs while holding
`withPositionsLock`. Web Locks are not reentrant
(`src/lib/concurrency/positionsLock.ts:26-36`), so the capacity read must not
itself take that lock — it is a different storage key and must stay that way.

**Not affected**

Rendering. The page already computes and renders at true capacity; only the
stored values it renders were wrong.
