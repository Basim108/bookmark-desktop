## Context

A folder drop in the sidebar is currently resolved by two independent pieces of
code that run on the same `onDragEnd` event and do not agree.

**Decision-maker 1 — `App.handleDragEnd`** (`src/newtab/App.tsx:75`) awaits
`resolveCrossFolderDrop` (`src/lib/bookmarks/dragResolve.ts:30`), which returns
`null` for every drop that `chrome.bookmarks.move` would reject or that would be
a no-op:

- the drop target is not a folder
- `activeId === destFolderId` (dropped onto itself)
- `activeData.sourceParentId === destFolderId` (dropped onto its current parent)
- the dragged folder is a protected root (`0`/`1`/`2`/`3`)
- the destination is a descendant of the dragged folder (cycle)

**Decision-maker 2 — `useSubfolders`** (`src/newtab/hooks/useSubfolders.ts:65`)
runs its own `useDndMonitor` and re-implements only *one* of those guards
(`overData.folderId === activeData.sourceParentId`), then optimistically filters
the dragged folder out of the source parent's list.

The two guard sets diverge on the self-drop and the cycle-drop:

```
        drop folder F (parent P) onto F itself
                        │
        ┌───────────────┴────────────────┐
        ▼                                ▼
  resolveCrossFolderDrop           useSubfolders monitor
  activeId === destId              over(F) !== sourceParentId(P)
        → null                           → does NOT skip
        → no API call                    → filters F out of P's children
        → returns before the             → F's row disappears
          catch/resync                   → nothing will bring it back
```

Because `handleDragEnd` bails at `if (!action) return;` (App.tsx:84), the
`forceBookmarkResync()` in its `catch` (App.tsx:95) — the mechanism designed for
exactly this "optimistic state is now wrong" situation — is never reached. No
`chrome.bookmarks` event fires either, since no API call was made. The row stays
gone until an unrelated create/remove/move/change event happens to tick the
hook's `reloadToken`.

The cycle-drop reaches the same end state through the resolver's ancestor check
(`dragResolve.ts:57-60`), which the hook cannot replicate because
`getFolderAncestorChain` is async and `useDndMonitor`'s callback is synchronous.

## Goals / Non-Goals

**Goals:**
- A folder drop that resolves to no move leaves the sidebar tree byte-identical
  to its pre-drag state, with the dragged row visible in its original position.
- Exactly one piece of code decides what a folder drop means.
- The fix generalizes: adding new drop outcomes (reorder, in the follow-up
  change) must not require re-deriving resolution logic in a second place.

**Non-Goals:**
- Changing what a *valid* folder-to-folder drop does. Reparenting behavior,
  the protected-root rules, and the cycle rejection all stay as they are.
- Adding folder reordering or between-row drop targets — that is
  `add-folder-reorder-by-drop-between-rows`.
- Touching bookmark-to-folder drags, canvas cell drops, or stored positions.

## Decisions

### Decision 1: Delete the optimistic removal; let the real event be the only writer

`useSubfolders` loses its `useDndMonitor` block entirely and becomes purely
event-driven: an initial fetch plus a refetch on any
`subscribeToBookmarkChanges` notification.

**Why deletion rather than adding the missing guards.** Two alternatives were
considered:

- *Copy the missing guards into the hook.* One line fixes the self-drop, but the
  cycle-drop cannot be fixed this way — the ancestor check is async and
  `useDndMonitor` is synchronous. It also leaves two decision-makers in place, so
  the next drop outcome added reopens the same class of bug.
- *Publish the resolved action from `App` and have the hook consume it.* Correct
  and keeps the optimism, but introduces new context/event plumbing to preserve
  an optimistic update whose benefit is unmeasurable (see below).

Deletion is the only option that removes the divergence rather than patching one
instance of it, and it removes code rather than adding it.

**Why the latency is a non-issue.** `chrome.bookmarks` events are delivered to
the extension's own contexts in-process; the round trip from `move()` to
`onMoved` to refetch is single-digit milliseconds and imperceptible. The
destination side of a folder move already relies on this path exclusively and
has done since the optimistic append was removed (see the rationale comment at
`useSubfolders.ts:17-30`).

**Risk considered and accepted.** That same comment records a historical flake
where a refetch "could occasionally resolve with stale data (Chrome's own
bookmark store lagging just behind the event it fires)". That failure required
*two* async writers settling out of order — the loser clobbering the winner with
nothing left to retrigger a retry. With one writer, a stale read is
self-consistent and self-correcting; and if post-`onMoved` reads were genuinely
stale, the destination side would already be broken today. If a lag is ever
observed, the escalation is the publish-the-resolved-action design above, not a
return to divergent guards.

### Decision 2: Keep `forceBookmarkResync()` on the rejected-move path

With the optimism gone, a rejected `chrome.bookmarks.move` leaves nothing locally
stale, so the resync is no longer load-bearing for this hook. It is retained
because the requirement specifies it, it costs one refetch on a path that only
runs when an API call has already failed, and it protects any future component
that does keep local drag state.

The `!action` early return does **not** gain a resync call. Under Decision 1
there is no optimistic state to correct on that path, and adding a refetch to
every no-op drop would mean a wasted round trip on the most common accidental
gesture (picking a folder up and putting it back).

### Decision 3: Preserve the existing e2e assertion rather than weaken it

`e2e/cross-folder-drag.spec.ts:185` asserts the reparented folder's row is no
longer visible under its old parent. This was written against the optimistic
path but does not depend on it: Playwright's `expect` polls until the default
timeout, and the real `onMoved` refetch resolves far inside that window. The
assertion stays as-is and becomes a genuine end-to-end check of the event path
instead of a check of a local prediction.

## Risks / Trade-offs

- **A regression here is silent-ish.** If the event path were ever to break, the
  sidebar would simply stop updating after a folder move rather than throwing.
  Mitigated by keeping the e2e assertion (Decision 3), which fails loudly.
- **Removing code that a past bug fix added.** The `useDndMonitor` block was
  presumably added deliberately. Its comment justifies the *destination* rule
  (one writer) but never justifies the source-side optimism, and the guard set it
  carries is provably incomplete. Removing it restores the one-writer principle
  the comment itself argues for.

## Migration Plan

Single atomic change; no data migration, no storage-schema change, no background
service-worker change. Stored positions and folder settings are untouched
because no move occurs on the fixed paths.

## Open Questions

None blocking. The `add-folder-reorder-by-drop-between-rows` change builds on the
single-resolver shape established here and will extend
`resolveCrossFolderDrop` (or a successor) rather than adding a second
decision-maker.
