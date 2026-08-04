## 1. Reproduce before fixing

> **Deviation from the original plan, recorded during implementation.** These
> tasks were written as jsdom drag simulations in `FolderTreeNode.test.tsx`. No
> unit test in this repo simulates a drag — jsdom reports 0x0 rects, so dnd-kit
> resolves no drop target, and the repo's convention is that drag behaviour is
> covered end-to-end in real Chrome (`e2e/cross-folder-drag.spec.ts`). The
> reproduce-first step was therefore split: a unit test pins the structural
> invariant, and section 4 pins the user-visible symptom in real Chrome. Both
> halves were confirmed to fail before the fix and pass after.

- [x] 1.1 Add `src/newtab/hooks/useSubfolders.test.tsx` asserting the hook works with **no `DndContext` ancestor** — the sharpest available proof that the folder list never depends on drag state. Failed before the fix with dnd-kit's `useDndMonitor must be used within a children of <DndContext>`
- [x] 1.2 Add a second case in the same file: the hook live-syncs on a `chrome.bookmarks` event with no `DndContext` ancestor. Failed before the fix for the same reason
- [x] 1.3 Confirm both failed against the pre-fix code for the stated reason (the hook observing drag state), not an unrelated one

## 2. Collapse the two decision-makers into one

- [x] 2.1 Delete the `useDndMonitor` block from `src/newtab/hooks/useSubfolders.ts` so the hook is fetch + event-refetch only
- [x] 2.2 Remove the now-unused `useDndMonitor` / `DragEndEvent` imports from that file
- [x] 2.3 Update the hook's doc comment: one writer (the live refetch), no drop predicted locally, and why — recording both the destination-side race and the source-side removal that re-derived `resolveCrossFolderDrop`'s decision incompletely
- [x] 2.4 Confirmed `src/newtab/App.tsx` needs no change — `resolveCrossFolderDrop` is already the sole resolver and `forceBookmarkResync()` stays on the rejected-move path per design Decision 2
- [x] 2.5 Verified the tests from section 1 now pass

## 3. Reconcile existing test expectations

- [x] 3.1 Searched for tests asserting the optimistic removal — **none existed**; the behaviour was only ever covered indirectly by the e2e reparent flow. Corrected the now-stale `Harness` doc comment in `FolderTreeNode.test.tsx`, which justified its `DndContext` by the coupling this change removes (the row's own `useDraggable`/`useDroppable` still require it)
- [x] 3.2 Ran the full unit suite — 452 tests across 52 files, all passing

## 4. End-to-end verification

- [x] 4.1 Added "dropping a folder onto itself leaves it exactly where it was" to `e2e/cross-folder-drag.spec.ts`, with a `dragOntoItself` helper that drags horizontally within the row so the pointer sensor's 8px activation distance is cleared without leaving the row (a centre-to-centre drop would never start a drag)
- [x] 4.2 Added "dropping a folder onto its own descendant leaves it exactly where it was" — expands the parent, drags it onto its own child, asserts the row is still visible and still under Bookmarks Bar
- [x] 4.3 Confirmed the existing reparent assertion still passes unmodified via the real `onMoved` path; updated only its comment, which described the removed optimistic update
- [x] 4.4 Ran `npm run test:e2e` — 59 tests, all passing
- [x] 4.5 Proved the new tests catch the bug: reverted only `useSubfolders.ts`, rebuilt, and confirmed both new tests fail with "element(s) not found" — the reported symptom — then restored the fix and confirmed green

## 5. Close out

- [x] 5.1 Ran `openspec validate fix-folder-drop-noop-removes-row --strict`
- [x] 5.2 Ran `npm run typecheck`, `npm run lint`, and `npm run format` — all clean
- [x] 5.3 Behaviour confirmed in real Chrome by the section 4 e2e tests (automated rather than a hand click-through, and stricter: they settle 500ms past the drop so a row that vanished and was restored by an unrelated resync cannot pass)
