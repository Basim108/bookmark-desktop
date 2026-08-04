## 0. Prerequisite

- [ ] 0.1 Confirm `fix-folder-drop-noop-removes-row` is implemented and merged — this change adds drop outcomes to the single-resolver shape that change establishes

## 1. Spike: pin the unknowns before writing the mapping

- [ ] 1.1 In the Playwright harness, use `page.evaluate` with `chrome.bookmarks` to determine whether `chrome.bookmarks.move(id, { parentId: <same>, index })` interprets `index` against the child list *before* or *after* the node is removed; cover moving both earlier and later within the parent
- [ ] 1.2 Record the finding in `design.md` under Decision 4, replacing the open statement with the observed behaviour
- [ ] 1.3 Verify dnd-kit droppable measuring: confirm whether gaps that mount at drag start (or whose `disabled` flips per drag) are hit-tested reliably, and whether `MeasuringStrategy.Always` on the `DndContext` is needed (design Decision 8)

## 2. Visual slot → bookmarks index mapping (pure)

- [ ] 2.1 Add a pure module mapping a gap ("insert before subfolder X", or "insert at end") to a `chrome.bookmarks` child index, anchoring to the following folder's own child index and to the parent's child count for the end slot (design Decision 3)
- [ ] 2.2 Fold the Decision 4 finding in as an explicitly named adjustment step — never a bare `- 1`
- [ ] 2.3 Unit-test over children with bookmarks interleaved between subfolders: insert at start, between two subfolders separated by a bookmark, and at the end; plus moving a folder both earlier and later within its parent
- [ ] 2.4 Add a test asserting the mapping is a no-op for the two slots adjacent to the folder's own position (these are never offered, but the mapping must not misbehave if reached)

## 3. Resolver: add the reorder outcome

- [ ] 3.1 Extend `src/lib/bookmarks/dragResolve.ts` with a `reorder-folder` action alongside `move-bookmark`/`move-folder`, carrying the folder id, its parent id, and the target slot
- [ ] 3.2 Return `null` for: a gap whose parent is not the dragged folder's parent, a gap adjacent to the folder's own position, a bookmark dragged over any gap, and a protected root folder
- [ ] 3.3 Extend `dragResolve.test.ts` for each of those rejections and for the accepted reorder
- [ ] 3.4 Add an index-aware move to `src/lib/bookmarks/move.ts` alongside `moveNodeToFolder`, and execute the new action in `App.handleDragEnd`

## 4. Gap drop targets

- [ ] 4.1 In `FolderTreeNode.tsx`, register a gap droppable anchored to the top edge of each folder row ("insert before this row"), plus one anchored below the last sibling's `<li>` ("insert at end") — design Decision 1
- [ ] 4.2 Read the active drag via `useDndContext()` and enable a gap only when it is a slot in the dragged folder's parent and not adjacent to the folder's own position (design Decision 2)
- [ ] 4.3 Ensure inactive gaps neither render an indicator nor capture the pointer, so the row beneath shows its normal reparent highlight
- [ ] 4.4 Apply the measuring strategy decided in task 1.3

## 5. Insert-line indicator

- [ ] 5.1 Add an accent colour token to `:root` in `main.css` using the existing `light-dark()` idiom; verify contrast against the row background and the neutral row wash in both schemes
- [ ] 5.2 Style the insert line: 2px tall, `border-radius: 1px`, `pointer-events: none`, starting at the dragged folder's indent and running to the row's right edge
- [ ] 5.3 Add the leading ring cap (~6px, 2px accent border, canvas-coloured fill); settle ring vs. solid dot against the real accent colour (design Open Questions)
- [ ] 5.4 Give the hit strip ~8-10px height independent of the 2px drawn line
- [ ] 5.5 Add a ~100ms fade so crossing gaps does not strobe
- [ ] 5.6 Verify absolutely-positioned strips and lines cause zero layout shift, with `.folder-row`'s existing `position: relative` as the anchor (design Decision 7)

## 6. Collision priority

- [ ] 6.1 Extend `collisionDetection` in `App.tsx` so an active gap wins outright over any row it overlaps, preserving the existing `pointerWithin` → `rectIntersection` fallback beneath it (design Decision 6)
- [ ] 6.2 Add a unit or component test asserting the row wash and the insert line are never both present

## 7. Component tests

- [ ] 7.1 `FolderTreeNode.test.tsx`: dragging a folder activates only its own parent's non-adjacent gaps
- [ ] 7.2 Dragging a bookmark activates no gaps at all
- [ ] 7.3 Dragging a folder over an inactive gap highlights the row beneath instead
- [ ] 7.4 The insert line renders at the dragged folder's indent, and stays at that indent across every live gap in one drag

## 8. End-to-end verification

- [ ] 8.1 Add `e2e/folder-reorder.spec.ts`: create three sibling folders, drag the third into the gap before the first, assert the sidebar order and `chrome.bookmarks` child order both reflect it and the parent is unchanged
- [ ] 8.2 Reorder to the end slot below an expanded sibling's subtree; assert the folder lands where the indicator was shown
- [ ] 8.3 Reorder within a parent whose children include bookmarks interleaved between subfolders; assert the resulting subfolder order matches what the user indicated
- [ ] 8.4 Assert a reorder changes no stored canvas position
- [ ] 8.5 Assert a bookmark released over a gap does not reorder anything and does not change the bookmark's folder
- [ ] 8.6 Confirm the existing reparent flows in `e2e/cross-folder-drag.spec.ts` still pass unmodified
- [ ] 8.7 Run `npm run test:e2e` and confirm green

## 9. Close out

- [ ] 9.1 Run `openspec validate add-folder-reorder-by-drop-between-rows --strict`
- [ ] 9.2 Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run format`
- [ ] 9.3 Manually confirm in the extension, in both light and dark schemes: reparent by row, reorder by gap, indicators never overlap, no row jitter during a drag
