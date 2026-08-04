/**
 * Reparents a bookmark or folder via the bookmarks API. Used for both
 * cross-folder drag targets (drag a bookmark onto a sidebar folder row,
 * drag a folder row onto another folder row) — the operation is
 * identical; only the dragged node's id differs. Destination placement
 * (next-free-cell for a moved bookmark) and position cleanup are handled
 * by the background `onMoved` listener, not here.
 */
export async function moveNodeToFolder(
  nodeId: string,
  destFolderId: string,
): Promise<void> {
  await chrome.bookmarks.move(nodeId, { parentId: destFolderId });
}

/**
 * Reorders a folder among its existing siblings, keeping its parent. Used by
 * the sidebar's between-rows drop gaps.
 *
 * `index` comes from lib/bookmarks/reorderSlot, which resolves it against
 * Chrome's pre-removal child list — see the trap documented there before
 * changing anything about how it is computed.
 *
 * Same-parent moves deliberately have no position consequences: the background
 * onMoved listener ignores them (stored canvas positions are never re-derived
 * from Chrome's child order), so this only affects the sidebar's own ordering.
 */
export async function reorderFolderWithinParent(
  folderId: string,
  parentId: string,
  index: number,
): Promise<void> {
  await chrome.bookmarks.move(folderId, { parentId, index });
}
