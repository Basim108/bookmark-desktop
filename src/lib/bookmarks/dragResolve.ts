import { getFolderAncestorChain, getFolderChildren } from "./read";
import { isNoOpSlot, resolveSlotIndex, type ReorderSlot } from "./reorderSlot";

/** Chrome's protected top-level folder ids — the tree root and its immediate children (Bookmarks Bar, Other Bookmarks, Mobile Bookmarks). chrome.bookmarks.move rejects moving any of these. */
const PROTECTED_ROOT_FOLDER_IDS = new Set(["0", "1", "2", "3"]);

export interface DraggedItemData {
  type?: string;
  sourceFolderId?: string;
  sourceParentId?: string;
}

export interface FolderDropData {
  type?: string;
  folderId?: string;
  /** Reorder gaps only: the parent whose sibling list this gap is a slot in. */
  gapParentId?: string;
  /** Reorder gaps only: which slot in that parent this gap represents. */
  slot?: ReorderSlot;
}

export type CrossFolderDropAction =
  | { kind: "move-bookmark"; bookmarkId: string; destFolderId: string }
  | { kind: "move-folder"; folderId: string; destFolderId: string }
  | {
      kind: "reorder-folder";
      folderId: string;
      parentId: string;
      index: number;
    };

/**
 * Decides what a sidebar drop represents, given the dragged item's data and
 * the drop target's data. The sidebar has two kinds of target: a folder row,
 * which reparents ("into"), and a between-rows gap, which reorders a folder
 * among the siblings it already has ("here, same parent").
 *
 * This is the single authority on what a drop means. Nothing else may predict
 * a drop or update the tree in response to one — an earlier version had the
 * sidebar's subfolder hook re-deriving a subset of these rules, which removed
 * a folder's row for drops that were rejected here and never happened.
 *
 * Returns null for same-canvas cell drops (handled separately by
 * lib/grid/dragDrop.ts) and for every drop that would change nothing or that
 * chrome.bookmarks.move would reject: self-drops, drops onto the item's
 * current parent, drags of a protected root folder, folder cycles (moving a
 * folder into one of its own descendants), bookmarks dropped into a gap, gaps
 * belonging to a different parent, and gaps adjacent to the dragged folder's
 * own position. A rejection fires no onMoved event to resync the UI, so
 * resolving to null must mean the UI is already correct.
 */
export async function resolveCrossFolderDrop(
  activeId: string,
  activeData: DraggedItemData | undefined,
  overData: FolderDropData | undefined,
): Promise<CrossFolderDropAction | null> {
  if (overData?.type === "folder-gap") {
    return resolveGapDrop(activeId, activeData, overData);
  }
  if (overData?.type !== "folder" || !overData.folderId) {
    return null;
  }
  const destFolderId = overData.folderId;
  if (activeId === destFolderId) {
    return null;
  }

  if (activeData?.type === "bookmark") {
    if (activeData.sourceFolderId === destFolderId) {
      return null;
    }
    return { kind: "move-bookmark", bookmarkId: activeId, destFolderId };
  }

  if (activeData?.type === "folder") {
    if (activeData.sourceParentId === destFolderId) {
      return null;
    }
    if (PROTECTED_ROOT_FOLDER_IDS.has(activeId)) {
      return null;
    }
    const destAncestors = await getFolderAncestorChain(destFolderId);
    if (destAncestors.includes(activeId)) {
      return null;
    }
    return { kind: "move-folder", folderId: activeId, destFolderId };
  }

  return null;
}

/**
 * Decides what a drop into a between-rows gap means. A gap only ever reorders
 * a folder among the siblings it already has — it never reparents — so every
 * case that isn't "this folder, moving within its own parent, to a slot that
 * actually changes something" resolves to nothing.
 *
 * The sidebar already declines to offer these as targets (see the folder-gap
 * droppables in FolderTreeNode); re-checking here keeps the resolver the single
 * authority on what a drop means rather than trusting the geometry layer.
 */
async function resolveGapDrop(
  activeId: string,
  activeData: DraggedItemData | undefined,
  overData: FolderDropData,
): Promise<CrossFolderDropAction | null> {
  // Gaps accept folders only. A bookmark dragged from the canvas has no
  // meaningful sibling order — its canvas placement is stored positionally —
  // so it is only ever accepted by a folder row.
  if (activeData?.type !== "folder") {
    return null;
  }
  if (PROTECTED_ROOT_FOLDER_IDS.has(activeId)) {
    return null;
  }
  const { gapParentId, slot } = overData;
  if (!gapParentId || !slot) {
    return null;
  }
  // Same-parent only: a gap under any other parent is not a target for this
  // folder, so the drop resolves to nothing rather than reparenting.
  if (activeData.sourceParentId !== gapParentId) {
    return null;
  }

  const children = await getFolderChildren(gapParentId);
  if (isNoOpSlot(children, activeId, slot)) {
    return null;
  }
  return {
    kind: "reorder-folder",
    folderId: activeId,
    parentId: gapParentId,
    index: resolveSlotIndex(children, slot),
  };
}
