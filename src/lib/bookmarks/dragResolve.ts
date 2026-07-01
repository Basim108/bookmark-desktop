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
 * self-drops, and no-op drops onto the item's current parent.
 */
export function resolveCrossFolderDrop(
  activeId: string,
  activeData: DraggedItemData | undefined,
  overData: FolderDropData | undefined,
): CrossFolderDropAction | null {
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
    return { kind: "move-folder", folderId: activeId, destFolderId };
  }

  return null;
}
