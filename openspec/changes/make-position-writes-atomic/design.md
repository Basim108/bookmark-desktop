## Context

Every writer of the positions store performs read-modify-write against one
`chrome.storage.local` key:

```
      service worker                     newtab page(s)
  ┌────────────────────┐          ┌────────────────────────┐
  │ placeNewBookmark   │          │ backfillFolderPositions│
  │ cleanUpRemoved…    │          │ reflowFolderPositions  │
  └─────────┬──────────┘          │ moveBookmarks (drag)   │
            │  mutex              └───────────┬────────────┘
            │  (in-process only)              │  no coordination
            └──────────────┬──────────────────┘
                           ▼
              chrome.storage.local["positions"]
```

`createMutex` is a module-level promise chain. It serializes callers *within one
JS realm*. The service worker and each newtab page are separate realms, so the
mutex provides no mutual exclusion between them — the arrangement above has two
independent writers and no lock.

Evidence (`Phase 1` of the investigation): creating 40 bookmarks from the page
while its initial backfill is in flight loses exactly one entry, in 6/6 runs.
Recording every `positions` write shows the entry committed and then dropped
(`…,6,7,6,7,…`), which is a lost update, not a placement that never happened.
Creating the same 40 from the service worker with no page mounted loses none.

## Goals / Non-Goals

**Goals:**

- No committed position is ever lost to a concurrent write from another context.
- The cell a placement computes cannot go stale between choosing and storing it.
- One obvious place to reach for when adding a future position writer.

**Non-Goals:**

- Changing the storage schema, the placement algorithm, or backfill semantics.
- Recovering already-stranded bookmarks (existing backfill already does this).
- Serializing anything other than the positions store.

## Decisions

### 1. Web Locks as the cross-context primitive

`navigator.locks` is the only lock primitive shared by an MV3 service worker and
extension pages. Verified in this extension before designing around it:

| Check | Result |
|---|---|
| `navigator.locks.request` in newtab page | present |
| `navigator.locks.request` in service worker | present |
| origin (page vs SW) | identical `chrome-extension://<id>` |
| SW waiting on a page-held lock | **blocked 693ms** until released |

The shared lock manager is what makes this work; nothing else available to both
contexts provides mutual exclusion. `chrome.storage.session` can hold a *flag*,
but testing and setting it is itself a race.

Alternatives considered:

- **Route every write through the service worker via messaging.** Genuinely
  single-writer, and the mutex would then suffice. Rejected as a much larger
  change: every page write path becomes an async round-trip with its own
  failure modes, and an MV3 worker that is asleep or torn down mid-import adds
  a new class of bug to a store that currently just works.
- **Merge instead of overwrite in backfill.** Re-reading and merging shrinks the
  window but does not close it — the re-read and the write are still two steps.
  A narrower race is still a race.

### 2. Lock-free internals + locked public operations

Web Locks are **not reentrant**: requesting a held name from inside its own
callback deadlocks. Since `backfillFolderPositions` must hold the lock across
its read *and* its call to `setFolderPositions`, a locked `setFolderPositions`
would deadlock it.

So `positions.ts` exposes two layers:

- `readAllPositionsUnlocked` / `writeAllPositionsUnlocked` — no lock, callable
  only from inside a held lock.
- the existing public operations — each acquires the lock exactly once and uses
  the unlocked internals underneath.

The rule that keeps this safe: **a locked function never calls another locked
function.** Composite operations (`placeNewBookmark`, backfill, reflow) take the
lock themselves and use the unlocked layer.

### 3. `placeNewBookmark` computes its cell inside the lock

Currently it reads positions, picks the next free cell, then calls
`setBookmarkPosition` — which re-reads. Two bookmarks can therefore be handed
the same cell even without any loss, because the cell was chosen from a snapshot
that the write does not reuse. Folding the choice and the store into one locked
section removes that separately.

### 4. The in-process mutex stays

`mutex.runExclusive` in `events.ts` also wraps settings and icon cleanup, which
this change does not touch. It is now redundant *for positions* but harmless.

No deadlock cycle is introduced: the service worker acquires mutex → web lock,
and the page acquires the web lock only. A cycle would need a context that takes
the web lock and then waits on the mutex, which does not exist.

### 5. Fallback when `navigator.locks` is absent

Unit tests run under jsdom, which does not implement Web Locks. The helper falls
back to a module-level in-context mutex when `navigator.locks` is unavailable —
preserving single-context correctness for tests without silently skipping
serialization. Real Chrome always takes the Web Lock path; the e2e suite is what
exercises it.

## Risks / Trade-offs

- **A stuck lock holder stalls all position writes.** Web Locks have no timeout;
  a callback that never settles blocks every other writer. → Every locked
  section is short, does no unbounded work, and awaits only `chrome.storage` /
  `chrome.bookmarks` calls. Nothing waits on user input or the network inside a
  lock.

- **MV3 teardown mid-write.** If the worker is killed while holding the lock,
  the lock is released with the context and the in-flight write is simply lost
  — the same as today, and the existing backfill re-seeds anything missing on
  next load.

- **Contention during a bulk import.** Every placement now serializes against
  page writes rather than racing them, so a large uTab import does slightly
  more waiting. → Correct beats fast here, and the SW already serialized these
  writes against each other via the mutex, so the added contention is only with
  page writes, which are rare.

- **The unlocked internals are a footgun** if called from outside a held lock.
  → Named with an explicit `Unlocked` suffix and documented as lock-required.

## Open Questions

None outstanding.
