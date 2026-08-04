## Why

Dragging a folder row in the sidebar and dropping it back onto itself makes the
row disappear. Nothing was moved — `chrome.bookmarks.move` is never called — but
the folder vanishes from the tree and stays gone until some unrelated bookmark
event happens to trigger a refetch. The same symptom occurs when a folder is
dropped onto one of its own descendants, a case the spec already claims leaves
the folder "in its original position".

The cause is that a folder drop is decided **twice, by two different pieces of
code that disagree**. `App.handleDragEnd` consults `resolveCrossFolderDrop`,
which correctly rejects self-drops, cycle-drops, protected roots, and drops onto
the current parent. `useSubfolders` independently re-implements a *subset* of
those guards inside its own `useDndMonitor` and optimistically removes the
dragged folder from the source list. Whenever the resolver says "no move" but
the hook's thinner guard set doesn't, the row is removed for a move that never
happens, and the `forceBookmarkResync()` safety net is never reached because
`handleDragEnd` returns early on the `!action` path.

Fixing this now also unblocks folder reordering: that feature adds more
drop outcomes (reorder vs. reparent vs. no-op), and duplicating the resolution
logic in a synchronous hook would multiply this class of bug.

## What Changes

- Remove the optimistic folder removal from `useSubfolders` so the sidebar has a
  **single writer**: the live refetch driven by real `chrome.bookmarks` events.
  The destination side of a folder move already works this way; the source side
  becomes consistent with it.
- A folder drop that resolves to no move (onto itself, onto its own descendant,
  onto its current parent, or onto a non-folder target) leaves the sidebar tree
  exactly as it was, with the dragged folder's row still in place.
- Correct the spec so the descendant/cycle-drop scenario describes behavior the
  code actually has, and state the single-source-of-truth rule explicitly rather
  than leaving it implied.

## Capabilities

### New Capabilities
<!-- None; this corrects existing sidebar folder-drag behavior. -->

### Modified Capabilities
- `folder-sidebar`: The **Folder-to-Folder Drag Nesting** requirement changes. A
  drop that resolves to no move must leave the tree untouched (the dragged
  folder's row remains visible in its original position), and the sidebar's
  folder list must be derived from the actual bookmark tree rather than from
  optimistic local prediction of a move.

## Impact

- `src/newtab/hooks/useSubfolders.ts` — delete the `useDndMonitor` block
  (lines 65-90) and the now-unused `@dnd-kit/core` imports; the hook becomes
  purely event-driven.
- `src/newtab/App.tsx` — unchanged behavior, but `forceBookmarkResync()` on the
  rejected-move path is retained as the specified safety net.
- `src/newtab/components/FolderTreeNode.test.tsx` — update or remove any test
  asserting the optimistic removal; add coverage for the no-op drops.
- `e2e/cross-folder-drag.spec.ts` — the existing "folder C is no longer visible"
  assertion still holds (Playwright `expect` auto-retries, and the real
  `onMoved` event lands in single-digit milliseconds); add an e2e case for the
  self-drop.
- No dependency, storage, or background-listener changes. Stored canvas
  positions are untouched.
