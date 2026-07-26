## Why

Bookmarks can end up permanently without a stored position — they exist in
Chrome but never appear on the canvas, and nothing ever retries them.

Stored positions live under a single `chrome.storage.local` key and are updated
by read-modify-write from two independent JS contexts:

- the **background service worker**, placing each new bookmark on `onCreated`
- the **newtab page**, writing the whole map from backfill, reflow and drag

The `mutex` in `lib/bookmarks/events.ts` serializes only the service worker.
The page is a separate JS context and takes no part in it, so a page write
built from a stale snapshot silently drops entries the SW committed in between.

Reproduced deterministically (40 bookmarks created from the page while its
first backfill is in flight, 6/6 runs). The recorded write sequence shows the
entry being written and then dropped — sizes `…5,6,7,6,7,8…`, never recovering:

| | |
|---|---|
| writes observed | 41 (40 placements + 1 page backfill) |
| final entries | 39 |
| lost id | written at write #6, absent from write #7 onward |

The window is not theoretical: `lib/import/utab.ts` creates bookmarks in bulk
from the page while the SW places each one. And because `setFolderPositions`
rewrites the *entire* positions map rather than one folder's slice, a stale
page write can also strand placements belonging to a **different** folder.

## What Changes

- Every read-modify-write of the positions store SHALL run while holding a
  single named lock shared by the service worker and every open newtab page,
  making each operation atomic across contexts.
- The three read-then-write pairs that currently span two separate calls —
  `placeNewBookmark`, `backfillFolderPositions`, `reflowFolderPositions` —
  hold that lock across *both* halves, so the value they compute from cannot
  change before they store it. Today `placeNewBookmark` also picks its target
  cell from a snapshot it re-reads before writing, which can hand two
  bookmarks the same cell.
- `lib/storage/positions.ts` grows lock-free internals for use inside a held
  lock, alongside the locked public operations, so no operation can nest a
  second acquisition of the same lock and deadlock.
- No storage schema change and no migration. Bookmarks already stranded
  without a position are recovered by the existing backfill on next load, which
  is unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bookmark-canvas`: adds a requirement that stored positions survive
  concurrent writes from multiple extension contexts. The existing *Position
  Persistence* and *Next-Free-Cell Placement* requirements already assume every
  bookmark gets and keeps a position; this makes the concurrency guarantee they
  depend on explicit and testable.

## Impact

- `src/lib/concurrency/` — new cross-context lock helper, alongside the
  existing in-context `mutex`.
- `src/lib/storage/positions.ts` — public operations acquire the lock; lock-free
  internals exported for composite operations.
- `src/lib/grid/seed.ts`, `src/lib/grid/reflow.ts`, `src/lib/bookmarks/events.ts`
  — the three composite read-then-write operations hold the lock across both
  halves.
- `e2e/position-write-concurrency.spec.ts` — new; reproduces the loss and the
  cross-folder variant.
- The in-context `mutex` in `events.ts` stays: it also guards settings/icon
  cleanup. No deadlock cycle exists, since the page never acquires that mutex.
