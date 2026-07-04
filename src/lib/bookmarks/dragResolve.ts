import { getFolderAncestorChain } from "./read";

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
}

export type CrossFolderDropAction =
  | { kind: "move-bookmark"; bookmarkId: string; destFolderId: string }
  | { kind: "move-folder"; folderId: string; destFolderId: string };

/**
 * Decides what cross-folder move (if any) a drop represents, given the
 * dragged item's data and the drop target's data. Returns null for
 * same-canvas cell drops (handled separately by lib/grid/dragDrop.ts),
 * self-drops, no-op drops onto the item's current parent, drags of a
 * protected root folder, and drops that would create a folder cycle (moving
 * a folder into one of its own descendants) — chrome.bookmarks.move rejects
 * all of these, and rejection fires no onMoved event to resync the UI.
 */
export async function resolveCrossFolderDrop(
  activeId: string,
  activeData: DraggedItemData | undefined,
  overData: FolderDropData | undefined,
): Promise<CrossFolderDropAction | null> {
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
