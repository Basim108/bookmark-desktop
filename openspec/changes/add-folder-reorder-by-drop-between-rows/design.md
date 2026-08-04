## Context

Today a folder row is a single droppable registered on the `.folder-select`
button (`src/newtab/components/FolderTreeNode.tsx:83-92`), and every folder drop
means the same thing: reparent the dragged folder as a child of the target.
`resolveCrossFolderDrop` (`src/lib/bookmarks/dragResolve.ts:30`) turns a drop
into at most one action, and `App.handleDragEnd` executes it.

Reordering needs a second kind of drop target and a second kind of action. The
persistence half is nearly free:

- `chrome.bookmarks.move(id, { parentId, index })` performs the reorder.
- The background `onMoved` listener explicitly ignores same-parent moves
  (`src/lib/bookmarks/events.ts:177-181`), because stored positions are never
  re-derived from Chrome's order.
- Canvas grid positions live in `chrome.storage.local` keyed by folder and
  bookmark id, independent of Chrome's child order. Reordering folders therefore
  cannot disturb any icon layout.
- `subscribeToBookmarkChanges` already refetches every subfolder list on
  `onMoved`, so the new order appears without new sync code.

The work is concentrated in the drop-target geometry and the visual language
that tells the two drop meanings apart.

### Prerequisite

This change depends on `fix-folder-drop-noop-removes-row`. That change removes
the second, divergent drop decision-maker in `useSubfolders`. Adding reorder
targets on top of the current two-decision-maker code would reintroduce the
disappearing-row bug at every newly-added no-op target.

## Goals / Non-Goals

**Goals:**
- Drop a folder into a gap between rows → it changes position among its siblings,
  keeping its existing parent.
- Drop a folder onto a row → it reparents, exactly as today.
- The two drop meanings are unmistakable while dragging, and the indicators are
  never both visible.
- The user cannot construct a drop that resolves to no change.
- Visual quality that reads as intentional, not as a stray border.

**Non-Goals:**
- Gaps that reparent. A gap never changes the dragged folder's parent — this was
  an explicit product decision. It removes the depth-ambiguity that indent-
  sensitive tree drop zones require, at the cost of not being able to
  reparent-and-position in one gesture.
- Bookmarks in gaps. A bookmark dragged from the canvas is accepted only by
  folder rows. Gap order is meaningless for bookmarks, whose canvas placement is
  stored positionally.
- Reordering root folders. Chrome rejects moving its protected top-level folders,
  so depth-0 gaps never activate.
- Keyboard reordering. Only `PointerSensor` is wired (`App.tsx:67-69`); this
  matches every existing drag feature and is not a regression introduced here.
- Changing how bookmarks are ordered or positioned anywhere.

## Decisions

### Decision 1: Every gap is "insert *before* row X"

The naive model — one gap after each row — produces an indicator that lies as
soon as a row is expanded:

```
  ▾ 📁 Work
  ━━━━━━━━━━━━━━━  ← "after Work" … but Work's children render below it,
    ▸ 📁 Projects      so the folder would not land where the line is drawn
```

Instead, every gap is expressed as **"insert before row X"** and anchored to the
top edge of X's `.folder-row`, plus one final **"insert at end"** anchored to the
bottom of the last sibling's `<li>`. The top of a row always immediately follows
the end of everything before it, subtree included, so a "before" anchor can never
misrepresent the outcome. N siblings produce N+1 gaps with no special cases.

### Decision 2: A gap is live only when it is a sibling slot and not a no-op

While dragging folder F out of parent P, a gap is live if and only if:

1. it is a slot in P's subfolder list, and
2. it is not the slot immediately before or after F's current position.

Rule 1 enforces same-parent-only. Rule 2 applies the lesson from
`fix-folder-drop-noop-removes-row` preemptively: a target that resolves to no
change is never offered, so the user cannot produce one.

```
Dragging "Archive" (parent = Work):

  ▾ 📁 Bookmarks Bar
    ▾ 📁 Work
      ━━━━━━━━━━━━━━     live — insert before Docs
      ▸ 📁 Docs
      ·············      inert — immediately before Archive = no change
      ▸ 📁 Archive       ← dragged (0.5 opacity, as today)
      ·············      inert — immediately after Archive = no change
      ▸ 📁 Notes
      ━━━━━━━━━━━━━━     live — insert at end of Work's children
    ▸ 📁 Personal        row still offers its normal reparent target
```

Inert gaps render no indicator and are disabled as droppables, so the pointer
resolves to the row underneath and gets that row's reparent wash. This avoids
dead zones: there is no position in the sidebar where the pointer produces no
feedback at all.

Implementation note: a gap needs to know the active drag to decide liveness.
`useDndContext()` inside `FolderTreeNode` exposes `active`, whose data already
carries `sourceParentId` (`FolderTreeNode.tsx:76-82`).

### Decision 3: Visual slot ≠ Chrome child index — map it in a pure module

The sidebar renders subfolders only; `getSubfolders` filters bookmarks out
(`src/lib/bookmarks/read.ts`), but those bookmarks still occupy child indexes:

```
P.children:  [0] 🔖 A   [1] 📁 F1   [2] 🔖 B   [3] 📁 F2   [4] 📁 F3
sidebar:                    F1                     F2         F3
                                ↑ "insert before F2" — index 2 or 3?
```

Both produce the same visible folder order and differ only in where the invisible
bookmark B ends up. **Rule: anchor to the following folder's own child index**
("insert before F2" → F2's index, here 3); for the "insert at end" slot, use the
parent's child count. This keeps bookmarks that already precede the insertion
point ahead of it, which is the least surprising result in Chrome's own bookmark
manager and on the bookmarks bar.

This mapping lives in a pure module with unit tests over interleaved
bookmark/folder children, not inline in a component.

### Decision 4: Pin Chrome's same-parent index semantics with a spike first

`chrome.bookmarks.move` does not document whether, for a same-parent move, the
supplied `index` is interpreted against the child list *before* or *after* the
node is removed. The two interpretations differ by one whenever the target index
is greater than the node's current index — the classic off-by-one in every
reorder implementation.

This is resolved empirically before the mapping code is finalized, using the
existing real-Chrome Playwright harness (`page.evaluate` with `chrome.bookmarks`
available, as in `e2e/cross-folder-drag.spec.ts:45`), and the discovered
behavior is locked in by a test so a Chrome change cannot silently break
reordering. Whatever the answer, the adjustment belongs in the Decision 3 module
as an explicit, named step — never as an unexplained `- 1`.

### Decision 5: Two indicators that differ in kind, not intensity

The existing drag-over highlight is an achromatic full-row wash,
`light-dark(rgb(0 0 0 / 8%), rgb(255 255 255 / 12%))` (`main.css:326-331`),
shared with hover and the active-folder state. If the gap indicator were "the
same wash but stronger", the two states would blur together under a moving
cursor. So they differ categorically:

| | reparent (drop *into*) | reorder (drop *between*) |
|---|---|---|
| target | the folder row | a gap |
| visual | full-row neutral wash — unchanged | 2px chromatic line + ring cap |
| meaning | "goes inside this folder" | "goes here, same parent" |

Anatomy of the line:

```
         ◖━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         ▲                                      ▲
    6px ring cap                    runs to the row's right edge
    (2px accent border,
     canvas-coloured fill)

    ├── indent ──┤
    starts at the dragged folder's own indent — aligned with the
    folder icons of the siblings it will sit among
```

- 2px tall, `border-radius: 1px`, `pointer-events: none`
- The ring cap is what separates a deliberate indicator from a stray border; it
  is the established idiom in tree/canvas editors
- Hit strip ≈ 8-10px tall, drawn line 2px: forgiving to hit, precise to read
- ~100ms fade so crossing gaps does not strobe
- **The indent is constant for the whole drag.** Same-parent-only means every
  live gap sits at one depth, so the line only ever moves vertically — a calm
  signal obtained for free from the product constraint

This introduces the project's first accent token. `:root` currently declares only
`color-scheme: light dark` (`main.css:1-3`), so the token is defined through the
same `light-dark()` idiom the stylesheet already uses throughout, and must carry
sufficient contrast against both the light and dark row backgrounds.

### Decision 6: Gap beats row in collision detection

A gap strip overlaps the edge of the row it is anchored to, so `pointerWithin`
can return both droppables and the UI would show the wash and the line at once —
which reads as broken. The `collisionDetection` at `App.tsx:22` gains an explicit
priority pass: if any live gap is among the collisions, it wins outright. The
existing `pointerWithin` → `rectIntersection` fallback for canvas cells is
preserved beneath it.

### Decision 7: Zero layout shift, absolutely positioned

Gap strips and lines are absolutely positioned. `.folder-row` is already
`position: relative` (`main.css:312`), and `.sidebar-scroll-area` (`main.css:60`)
is the scroll container, so absolutely-positioned children scroll with content
correctly. If gaps contributed height, rows would shift under the cursor
mid-drag, moving the target away from the pointer and producing a jitter loop.

### Decision 8: Droppable measuring strategy

dnd-kit's default droppable measuring (`WhileDragging`) measures at drag start.
Gaps whose `disabled` flag is computed from the active drag — or which mount once
a drag begins — can end up unmeasured and silently unhittable. The expected fix
is `measuring: { droppable: { strategy: MeasuringStrategy.Always } }` on the
`DndContext`, verified during the same spike as Decision 4 rather than assumed.

## Risks / Trade-offs

- **Same-parent-only is a real capability limit.** A user who wants to both
  reparent and position must do it in two gestures. Accepted deliberately: the
  general alternative (gap means "sibling of the row above, at its depth")
  reintroduces subtree-boundary ambiguity and typically needs horizontal drag to
  disambiguate depth — considerably harder to build and to explain.
- **Chrome's index semantics are the highest-risk unknown.** Mitigated by
  Decision 4: spike first, lock behavior in a test.
- **Two overlapping droppables per boundary** roughly doubles the sidebar's
  droppable count during a drag. Folder trees are small and only sibling gaps are
  enabled, so this is not expected to matter; worth a sanity check on a deep
  tree.
- **Accent contrast in both schemes.** A single accent must stay legible against
  both light and dark row washes; verify rather than eyeball.

## Migration Plan

Purely additive to the UI layer. No storage-schema change, no background
service-worker change, no stored-position change, no dependency change
(`@dnd-kit/core` already provides everything needed). Existing reparent drags
behave identically.

## Open Questions

- **Folder drag preview.** Folders currently drag by translating `.folder-select`
  itself (`FolderTreeNode.tsx:126-129`), so the label detaches and slides around
  inside the sidebar, while bookmarks use a proper `DragOverlay`
  (`Canvas.tsx:258-262`). Against a crisp insert line this will look unfinished.
  A small folder drag chip reusing the existing overlay pattern is the piece that
  takes this to the intended polish bar. Deliberately left out of scope here —
  it is separable and can ship as its own change.
- **Ring cap vs. solid dot** for the line's leading edge. Ring reads lighter and
  is the more common idiom; solid is marginally more visible at small sizes.
  Settle it against the real accent color during implementation.
