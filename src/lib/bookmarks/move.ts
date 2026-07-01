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
