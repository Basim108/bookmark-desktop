## 0. Prerequisite

- [x] 0.1 `fix-folder-drop-noop-removes-row` merged (PR #55, 2026-08-04); this change builds on its single-resolver shape

## 1. Spike: pin the unknowns before writing the mapping

- [x] 1.1 Probed `chrome.bookmarks.move` same-parent index semantics in the real-Chrome harness, both directions. **Chrome reads `index` against the list *before* the node is removed** — moving later lands at `index - 1`, moving earlier lands exactly
- [x] 1.2 Recorded in design.md Decision 4 with the full probe table. The consequence is better than feared: pre-removal reading is exactly "insert before whichever node sits at index i", which is how a gap is defined — so the mapping needs **no adjustment in either direction**
- [x] 1.3 Resolved the dnd-kit measuring question by removing it rather than working around it (design Decision 8 rewritten): gaps are mounted and enabled from first render, so they measure like any other droppable, and liveness is applied in `collisionDetection` instead. Avoids `MeasuringStrategy.Always` re-measuring every droppable on every pointer move

## 2. Visual slot → bookmarks index mapping (pure)

- [x] 2.1 Added `src/lib/bookmarks/reorderSlot.ts` — `resolveSlotIndex` anchors to the following subfolder's own child index, or the parent's child count for the end slot
- [x] 2.2 No adjustment step was needed (task 1.2). The probe table is carried in the module's doc comment as a trap warning, since a reader who assumes `index` is the final resting index will "correct" the apparent off-by-one and silently break every downward reorder
- [x] 2.3 Unit tests over interleaved children: insert at start, between subfolders separated by a bookmark, at the end, all-subfolder parents, and a vanished anchor
- [x] 2.4 Added `isNoOpSlot` plus tests for both adjacent slots and the already-last end slot

## 3. Resolver: add the reorder outcome

- [x] 3.1 Extended `dragResolve.ts` with a `reorder-folder` action carrying folder id, parent id, and resolved index
- [x] 3.2 Returns null for: a gap under a different parent, a gap adjacent to the folder's own position, a bookmark over any gap, a protected root, and malformed gap data
- [x] 3.3 Nine new cases in `dragResolve.test.ts` (18 total in the file)
- [x] 3.4 Added `reorderFolderWithinParent` to `move.ts` and wired the new action through `App.handleDragEnd`

## 4. Gap drop targets

- [x] 4.1 Added `FolderDropGap`, rendered as "insert before this row" inside each non-root `.folder-row`, plus an "insert at end" gap in a zero-height `<li>` after the last sibling's whole `<li>` — so the end gap lands below that sibling's subtree, not under its row
- [x] 4.2 Liveness derived from the active drag via `isGapLiveFor`, using each gap's `previousSubfolderId` so adjacency is decided synchronously from the rendered order with no `chrome.bookmarks` read
- [x] 4.3 Non-live gaps are filtered out of collisions, so the pointer falls through to the row beneath and that row shows its normal reparent highlight
- [x] 4.4 No measuring-strategy change needed — see task 1.3

## 5. Insert-line indicator

- [x] 5.1 Added `--accent` and `--accent-cap-fill` to `:root` via the existing `light-dark()` idiom (the project's first accent tokens)
- [x] 5.2 2px line, `border-radius: 1px`, `pointer-events: none`, `left` set inline to the dragged folder's indent, running to the row's right edge
- [x] 5.3 6px ring cap (2px accent border, surface-coloured fill). Kept the ring over a solid dot — it reads lighter against the row and is the established idiom
- [x] 5.4 10px hit strip against the 2px drawn line
- [x] 5.5 100ms fade in, with a `prefers-reduced-motion` opt-out
- [x] 5.6 Absolutely positioned throughout, anchored on `.folder-row`'s existing `position: relative`; the end-gap `<li>` is zero-height. Verified no layout shift by the e2e drag tests

## 6. Collision priority

- [x] 6.1 Extracted `collisionDetection` from `App.tsx` into its own module (so it is directly testable) and added the two-step rule: drop non-live gaps, then let a surviving gap win outright
- [x] 6.2 `collisionDetection.test.ts` drives the real function with synthetic geometry — no DOM needed — covering gap-wins, fall-through for adjacent/foreign gaps, bookmarks offered no gap, and plain rows unaffected

## 7. Component tests

> **Deviation, recorded during implementation.** These were written as jsdom
> drag simulations. As established in the previous change, no unit test here can
> simulate a drag (jsdom reports 0x0 rects, so dnd-kit resolves no target). The
> logic behind each was covered instead by pure-function tests, and the rendered
> behaviour by the real-Chrome e2e in section 8.

- [x] 7.1 Covered by `isGapLiveFor` tests: only the dragged folder's own parent's non-adjacent gaps are offered
- [x] 7.2 Covered by `collisionDetection` test "offers no gap at all while a bookmark is being dragged", and e2e 8.5
- [x] 7.3 Covered by `collisionDetection` fall-through tests, and asserted visually in e2e (the row beneath shows `--over`)
- [x] 7.4 Covered by e2e: the line's computed `left` is 32px at depth 1 and identical across two different live gaps in one drag

## 8. End-to-end verification

- [x] 8.1 `e2e/folder-reorder.spec.ts`: three siblings, drag the third into the gap before the first; asserts both the `chrome.bookmarks` child order and the rendered sidebar order, and that the parent is unchanged
- [x] 8.2 End slot below an expanded sibling's subtree — targets the point below the *nested* row, so an implementation that anchored the end gap to the row instead of the subtree would fail
- [x] 8.3 Reorder within a parent with bookmarks interleaved between subfolders; also asserts the bookmarks keep their relative order
- [x] 8.4 Snapshots `chrome.storage.local` positions before and after a reorder and asserts they are byte-identical
- [x] 8.5 Bookmark released over a gap. Strengthened after first writing it: the original aimed at the bookmark's *own* folder's gap and asserted "nothing changed", which would have passed even if the drag never activated. Now aims at a *different* folder's gap, so the outcome distinguishes three cases — and asserts the bookmark moved into that folder, proving the gap declined and the row beneath accepted
- [x] 8.6 Existing reparent flows in `e2e/cross-folder-drag.spec.ts` pass unmodified
- [x] 8.7 `npm run test:e2e` — 65 tests passing; the reorder spec also run with `--repeat-each=3` (18/18) after fixing a flake where the rendered order was asserted once instead of polled

## 9. Close out

- [x] 9.1 `openspec validate add-folder-reorder-by-drop-between-rows --strict`
- [x] 9.2 `npm test` (484), `npm run typecheck`, `npm run lint`, `npm run format` — all clean
- [x] 9.3 Behaviour confirmed in real Chrome by the section 8 e2e, including a mid-drag assertion (mouse held down) that the insert line and the row wash are never both present, that the line's indent stays constant across gaps, and that no row shifts

## Findings worth carrying forward

- **The row's drop target is its label button, not the row.** Measured: row `y 116..154`, button `y 119..151`, gap `y 111..121`. So a gap and the row it overlaps share only a ~2px band. For folder drags this is invisible (the gap wins in the overlap), but during a *bookmark* drag the 8px band above a row's button has no drop target at all. That dead band predates this change — the button was always the droppable — so it is not a regression, but making `.folder-row` the droppable would be a genuine improvement worth its own change.
