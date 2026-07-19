## Context

`before-publish-report.md` (2026-07-19, commit `a17a75d`) recorded 11 findings
from a full pre-publication review of v1.0.0. All 11 are bundled here as one
change because they share a single deadline — the Chrome Web Store submission —
and because the P1 group is small, tightly localized to
`src/lib/transfer/`, and cheapest to fix as one pass over that module.

Current state of the affected areas:

- `importState()` runs a per-root create-before-delete pass under a transfer
  lock, then restores the general block. It never touches stored data belonging
  to the tree it just deleted.
- `events.ts` holds the lock as a module-level `let transferImportLocked`, set
  by a runtime message from the newtab importer. All four bookmark listeners
  return early while it is set — including the `onRemoved` cleanup that would
  otherwise garbage-collect the deleted items' data.
- `lock.ts` already treats the background ack as best-effort: a failed or
  unanswered `sendMessage` is swallowed so a sleeping worker cannot block an
  import.

The constraint that shapes most of this design: the lock is *load-bearing* for
correctness (it stops auto-placement from fighting the importer's authoritative
position writes) but it is also what creates finding 3 (it suppresses the
cleanup that would have collected the old data). Those cannot both be fixed by
weakening the lock.

## Goals / Non-Goals

**Goals:**

- An import leaves stored data in exactly the state a fresh import of the same
  file into a clean profile would produce — no residue from the replaced tree.
- The two global images cannot be used to write unvalidated bytes to storage.
- A service-worker teardown mid-import cannot produce an unlocked import, and a
  crashed importer cannot wedge synchronization permanently.
- The store submission is unblocked: a linkable privacy policy and regenerable
  screenshot assets.
- Clear the P2/P3 items while the code is fresh.

**Non-Goals:**

- No change to the export file format, and therefore no version bump. Findings
  3 and 4 are import-side read/cleanup behavior only; files written before and
  after this change are interchangeable.
- Not making the import transactional. If it fails partway the tree is still
  left partially replaced — that is the existing, accepted behavior, and the
  backup prompt is the mitigation.
- Not reworking the lock's best-effort acquire into a hard requirement. An
  import must still proceed when the background worker cannot be reached.
- Not switching `blobToDataUrl` to `FileReader`. Its docstring documents the
  deliberate avoidance so it works in both page and worker contexts.

## Decisions

### Sweep by keep-set, not by diff against the old tree

The importer already accumulates what it creates. Rather than snapshotting the
old tree's ids before deletion and subtracting them, the importer will collect
the set of ids it wrote and then prune every stored entry not in that set.

Chosen because a keep-set is correct under partial failure. A subtract-the-old
approach only removes data for ids it managed to observe before deleting; if a
root was skipped as unavailable, or a delete threw, the residue survives — which
is exactly the class of bug being fixed. Pruning to the keep-set converges on
the right state regardless of which roots succeeded.

The one hazard is the inverse: if the keep-set is wrong, the sweep deletes live
data. Two guards follow from that — the reserved global keys
(`__default_folder_icon__`, `__canvas_background__`) are unconditionally
exempt, and the sweep runs only on the success path inside the lock, never in
the `finally` that releases it.

*Alternative considered:* let the normal `onRemoved` cascade do the cleanup by
not suppressing it during the delete phase. Rejected — the cascade would also
run against the ids the importer had just created in the same root, since
create-before-delete means old and new coexist; and it races the importer's own
writes, which is the reason the lock exists.

### Add explicit reset primitives to the storage modules

The sweep cannot be written against today's storage API:

| Store | Today | Needed |
|---|---|---|
| `iconDb` | `putIcon` / `getIcon` / `deleteIcon` | enumerate keys, or delete-all-except |
| `positions` | `setFolderPositions` (merges) | replace whole map |
| `bookmarkSettings` | per-item set/remove | replace whole map |
| `folderSettings` | per-item set/remove | replace whole map |

Each store gains one narrow primitive rather than the importer reaching into
`chrome.storage.local` and IndexedDB directly. Keeping the key layout knowledge
inside the module that owns it is what the current structure already does, and
it keeps the sweep unit-testable per store.

The new `iconDb` primitive takes the keep-set and deletes the complement in one
transaction, rather than exposing a raw key listing — a narrower surface, and it
avoids a read-then-write window where a concurrent `putIcon` could be lost.

### Persist the lock in `chrome.storage.session` with a taken-at timestamp

`storage.session` is the right store: it is worker-restart-durable but clears
when the browser closes, so a lock can never outlive the session that created
it. It needs no new manifest permission — `storage` already covers it.

The timestamp bounds the damage from a crashed importer. Listeners treat a lock
older than a bounded maximum import duration as absent. The bound must exceed a
realistic worst-case import (a large tree with many ~1 MB icon blobs), so a
generous value is correct here — the cost of an over-long bound is a temporarily
unsynchronized profile, while an under-short one reintroduces the race this
fixes.

This makes the listener guard `async`, since it now reads storage before
deciding. The in-memory flag is kept as a synchronous fast path and the stored
record as the authority, so the common case does not pay a storage read and a
restarted worker still sees the truth.

*Alternative considered:* have the importer re-assert the lock periodically
(a heartbeat). Rejected as more moving parts for the same guarantee — the
timestamp already expresses "this lock is only trustworthy for so long".

### Drop `file:` and `ftp:` from the allowlist, not just the copy

The report offered either dropping them from the message or keeping them and
adding a hint. Removing both from `ALLOWED_NAVIGATION_SCHEMES` as well is
chosen: a scheme that cannot navigate from the new-tab page is not a capability
the extension has, and leaving it on the allowlist means the editor accepts
URLs it will silently fail to open. Narrowing an allowlist is also the safe
direction of change for a security-relevant list.

The user-visible consequence is that an existing `file:`/`ftp:` bookmark stops
being editable-as-valid. This is acceptable: clicking it already did nothing.

### Screenshots via a Playwright script, not the e2e suite

The capture script lives alongside the e2e setup and reuses its
extension-loading fixture, but is a separate entry point invoked by an npm
script. It writes assets; it asserts nothing. Folding it into the e2e suite
would make CI produce binary artifacts on every run and make a store-asset
change look like a test failure.

The 1280×800 requirement is met by setting the viewport, not by post-cropping,
so re-running after a UI change yields correctly sized assets with no manual
step.

## Risks / Trade-offs

**The sweep deletes live user data if the keep-set is incomplete** → The single
highest-consequence change in this batch. Mitigations: reserved global keys are
unconditionally exempt; the sweep runs only on the success path inside the lock;
the keep-set is built from the same accumulator that already drives the
created-counts, so a missing id would also show as a wrong count in existing
tests. Tests must cover the partial-failure paths specifically — a root that is
unavailable, and a root whose creation threw — since those are where an id could
be created but not recorded.

**Import becomes destructive toward data it previously left alone** → This is
the intended correction, but it removes an accidental safety net: today a user
who imports the wrong file still has their old layout data sitting in storage.
It was never reachable through any UI, so nothing is actually lost, and the
backup prompt remains the real recovery path.

**Async listener guard widens a race window** → Reading the lock from storage
means an event can arrive before the read resolves. The in-memory fast path
covers the case that matters (same worker, lock already known), and the stored
read only decides events on a worker that restarted mid-import — where today the
answer is unconditionally wrong.

**A too-short staleness bound reintroduces the unlocked-import race on slow
imports** → Choose the bound against a worst-case large import, and treat
crossing it as the rare case it is.

**Narrowing the scheme allowlist could surprise a user with `file:` bookmarks**
→ Those bookmarks already did nothing on click; the change makes the failure
visible at edit time instead of silent at click time.

**Bundling 11 findings into one change means the P0 store work cannot archive
until the P1 code work lands** → Accepted deliberately: the submission is a
single event, and shipping the P0 assets without the P1 fixes would put the
export/import feature in front of real users' data in the state the report
flagged.
