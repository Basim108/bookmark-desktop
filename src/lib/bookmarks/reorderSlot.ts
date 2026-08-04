import { isFolder } from "./read";

/**
 * Where a folder should land among its siblings, expressed the way the sidebar
 * renders drop gaps: "insert before this subfolder", or "insert at the end".
 *
 * Every gap is a *before* slot (see the folder-sidebar design) because the top
 * edge of a row always immediately follows the end of everything above it,
 * subtree included — so a before-anchor can never indicate a position the
 * folder won't actually land in, even when the preceding sibling is expanded.
 */
export type ReorderSlot =
  { kind: "before"; subfolderId: string } | { kind: "end" };

/**
 * Translates a gap into the `index` to hand `chrome.bookmarks.move`.
 *
 * The sidebar lists subfolders only, but a parent's children may also include
 * bookmarks, which still occupy child indexes:
 *
 *     children:  [0] bookmark  [1] F1  [2] bookmark  [3] F2  [4] F3
 *     sidebar:                     F1                   F2      F3
 *
 * So a gap's visible sibling position is not its child index; the anchor
 * subfolder's own index is.
 *
 * IMPORTANT — do not "fix" the apparent off-by-one. Chrome interprets `index`
 * against the child list *before* the moved node is removed, which is exactly
 * what "insert before whichever node currently sits at index i" means. Passing
 * the anchor's current index is therefore correct in both directions, with no
 * adjustment. Measured against children `[A, B, C, D]`:
 *
 *   | move                | index passed | lands at | final order      |
 *   |---------------------|--------------|----------|------------------|
 *   | A (0) later         | 2            | 1        | BACD             |
 *   | A (0) later         | 4 (count)    | 3        | BCDA             |
 *   | A (0) later         | 1            | 0        | ABCD (unchanged) |
 *   | D (3) earlier       | 1            | 1        | ADBC             |
 *
 * A reader who assumes `index` is the final resting index will see the shift on
 * downward moves, subtract one to "correct" it, and silently break every
 * downward reorder. `reorderSlot.test.ts` locks the behaviour in.
 */
export function resolveSlotIndex(
  children: chrome.bookmarks.BookmarkTreeNode[],
  slot: ReorderSlot,
): number {
  if (slot.kind === "end") {
    return children.length;
  }
  const anchorIndex = children.findIndex(
    (child) => child.id === slot.subfolderId,
  );
  // An anchor that is no longer among the children (removed in Chrome's own
  // manager mid-drag) degrades to appending rather than throwing; the live
  // resync settles the view either way.
  return anchorIndex === -1 ? children.length : anchorIndex;
}

/** The droppable data a sidebar reorder gap carries. */
export interface GapDropData {
  gapParentId?: string | undefined;
  slot?: ReorderSlot | undefined;
  /**
   * The subfolder rendered immediately above this gap, if any. Lets liveness be
   * decided synchronously from what the sidebar is showing, without a
   * chrome.bookmarks read — see isGapLiveFor.
   */
  previousSubfolderId?: string | undefined;
}

/**
 * Whether a gap should be offered as a drop target for the folder currently
 * being dragged: it must be a slot in that folder's own parent, and must not
 * sit immediately before or after the folder (dropping there changes nothing).
 *
 * Synchronous by design, because collision detection runs on every pointer
 * move. It reads adjacency off the rendered sibling order rather than the
 * bookmark tree, which is why each gap carries the id of the subfolder above
 * it.
 *
 * This decides only what the sidebar *offers* — never what a drop *does*.
 * resolveCrossFolderDrop re-checks against the real tree and remains the sole
 * authority on the outcome; if the two ever disagree, the resolver wins and
 * nothing happens, leaving the tree untouched. That separation is deliberate:
 * a component that acts on its own reading of a drop is exactly what made
 * folders vanish from the sidebar before.
 */
export function isGapLiveFor(
  gap: GapDropData,
  draggedFolderId: string,
  sourceParentId: string | undefined,
): boolean {
  if (!gap.gapParentId || !gap.slot) {
    return false;
  }
  if (sourceParentId !== gap.gapParentId) {
    return false;
  }
  if (gap.previousSubfolderId === draggedFolderId) {
    return false;
  }
  return !(
    gap.slot.kind === "before" && gap.slot.subfolderId === draggedFolderId
  );
}

/**
 * Whether dropping `folderId` into `slot` would leave the sibling order
 * unchanged — true for the gap immediately before the folder itself, and for
 * the gap immediately after it (which is the "before" gap of its next
 * subfolder sibling, or the end slot when it is already last).
 *
 * The authoritative counterpart to isGapLiveFor: that one decides what the
 * sidebar offers, from the rendered order; this one decides what a drop does,
 * from the real bookmark tree.
 */
export function isNoOpSlot(
  children: chrome.bookmarks.BookmarkTreeNode[],
  folderId: string,
  slot: ReorderSlot,
): boolean {
  const subfolders = children.filter(isFolder);
  const position = subfolders.findIndex((child) => child.id === folderId);
  if (position === -1) {
    return false;
  }
  if (slot.kind === "end") {
    return position === subfolders.length - 1;
  }
  if (slot.subfolderId === folderId) {
    return true;
  }
  const next = subfolders[position + 1];
  return next !== undefined && next.id === slot.subfolderId;
}
