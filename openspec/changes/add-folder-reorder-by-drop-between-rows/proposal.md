## Why

The sidebar's folder tree can only be restructured in one way: drag a folder
onto another folder to nest it inside. There is no way to change the *order* of
folders. Users who want a frequently-used folder near the top of its parent's
list, or who want to group related folders adjacently, have to leave the
extension and reorder in Chrome's own bookmark manager.

Reordering is cheap to persist here — `chrome.bookmarks.move` accepts an index,
the background listener already ignores same-parent moves by design
(`src/lib/bookmarks/events.ts:177-181`), and canvas grid positions are stored
independently of Chrome's child order, so reordering folders cannot disturb any
icon layout. What is missing is a drop target that means "here, in order" rather
than "inside this folder", and a way to tell the two apart at a glance.

## What Changes

- Add **between-row drop targets** ("gaps") to the sidebar folder tree. Dropping
  a dragged folder into a gap moves it to that position **within its existing
  parent**; its parent does not change.
- Keep the existing row drop target unchanged: dropping a folder *onto* a folder
  row still reparents it as a child.
- **Same-parent only.** While a folder is being dragged, only the gaps between
  that folder's own current siblings are live drop targets. Gaps elsewhere in the
  tree are inert and let the pointer fall through to the row beneath, which
  offers its normal reparent target.
- **No no-op targets.** The gaps immediately before and after the dragged folder
  are inert, since dropping there would change nothing.
- **Bookmarks cannot be dropped into a gap.** A bookmark dragged from the canvas
  is only ever accepted by a folder row, exactly as today.
- Add a distinct **insert-line indicator**: a 2px accent line with a leading ring
  cap, drawn at the dragged folder's own indent. The existing neutral full-row
  wash continues to signal reparenting. The two indicators are never shown at the
  same time.
- Introduce the project's first accent color token, since `:root` currently
  defines only `color-scheme` and the reparent highlight is achromatic.

## Capabilities

### New Capabilities
<!-- None; this extends existing sidebar folder-drag behavior. -->

### Modified Capabilities
- `folder-sidebar`: The **Folder-to-Folder Drag Nesting** requirement gains a
  sibling reorder mode with its own drop targets and rules about which are live.
  The **Folder Row Presentation** requirement (row highlight on hover/drag-over)
  gains the distinct insert-line indicator and the rule that the row wash and the
  insert line are mutually exclusive. The **Bookmark-to-Folder Drag Move**
  requirement is clarified: gaps do not accept bookmarks.

## Impact

- **Depends on `fix-folder-drop-noop-removes-row`.** That change makes drop
  resolution single-sourced; this one adds outcomes to that resolution. Building
  it first on the current two-decision-maker code would reintroduce the
  disappearing-row bug at every new no-op target.
- `src/lib/bookmarks/dragResolve.ts` — extend the resolver with a
  `reorder-folder` outcome alongside `move-folder`/`move-bookmark`.
- New pure module for visual-slot → `chrome.bookmarks` child-index mapping
  (the sidebar shows folders only, but bookmarks occupy child indexes), plus its
  unit tests.
- `src/lib/bookmarks/move.ts` — add an index-aware move alongside
  `moveNodeToFolder`.
- `src/newtab/components/FolderTreeNode.tsx` — render gap droppables and the
  insert-line indicator; read the active drag to decide which gaps are live.
- `src/newtab/App.tsx` — gap-beats-row priority in `collisionDetection`; likely
  `MeasuringStrategy.Always` on the `DndContext`.
- `src/newtab/main.css` — accent token, insert-line and ring-cap styles.
- e2e coverage under `e2e/` for reorder within a parent, gap inertness outside
  it, and bookmark-into-gap rejection.
- **Spike required before implementation**: Chrome's `chrome.bookmarks.move`
  index semantics for same-parent moves (whether the index is interpreted
  pre- or post-removal) are not documented and must be pinned by a test in the
  real-Chrome Playwright harness.
- No storage-schema, background-listener, or stored-position changes.
