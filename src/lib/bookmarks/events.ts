import { createMutex } from "../concurrency/mutex";
import { DEFAULT_GRID_CAPACITY, getNextFreeCell } from "../grid/placement";
import { backfillFolderPositions } from "../grid/seed";
import {
  getFolderPositions,
  removeBookmarkPosition,
  setBookmarkPosition,
} from "../storage/positions";
import { isBookmark } from "./read";

const mutex = createMutex();

async function placeNewBookmark(folderId: string, bookmarkId: string) {
  const existing = await getFolderPositions(folderId);
  const cell = getNextFreeCell(Object.values(existing), DEFAULT_GRID_CAPACITY);
  await setBookmarkPosition(folderId, bookmarkId, cell);
}

/** Recursively removes stored positions for a removed node and, if it was a folder, every bookmark nested inside it. */
async function cleanUpRemovedSubtree(
  node: chrome.bookmarks.BookmarkTreeNode,
  parentId: string,
) {
  if (isBookmark(node)) {
    await removeBookmarkPosition(parentId, node.id);
    return;
  }
  for (const child of node.children ?? []) {
    await cleanUpRemovedSubtree(child, node.id);
  }
}

// Import batching: Chrome recommends expensive onCreated observers ignore
// updates until onImportEnded fires, since a bulk import can create
// thousands of bookmarks synchronously. We buffer the affected folders and
// backfill them once, instead of doing a placement write per item.
let importInProgress = false;
const importTouchedFolders = new Set<string>();

/**
 * Wires the chrome.bookmarks listeners that keep stored positions
 * consistent with live bookmark structure changes. Safe to call once per
 * service worker lifetime (e.g. from the background entry point).
 */
export function registerBookmarkListeners(): void {
  chrome.bookmarks.onImportBegan.addListener(() => {
    importInProgress = true;
    importTouchedFolders.clear();
  });

  chrome.bookmarks.onImportEnded.addListener(() => {
    importInProgress = false;
    const folders = [...importTouchedFolders];
    importTouchedFolders.clear();
    for (const folderId of folders) {
      void mutex.runExclusive(() => backfillFolderPositions(folderId));
    }
  });

  chrome.bookmarks.onCreated.addListener((id, bookmark) => {
    if (!isBookmark(bookmark) || !bookmark.parentId) {
      return;
    }
    if (importInProgress) {
      importTouchedFolders.add(bookmark.parentId);
      return;
    }
    const parentId = bookmark.parentId;
    void mutex.runExclusive(() => placeNewBookmark(parentId, id));
  });

  chrome.bookmarks.onRemoved.addListener((_id, removeInfo) => {
    void mutex.runExclusive(() =>
      cleanUpRemovedSubtree(removeInfo.node, removeInfo.parentId),
    );
  });

  chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
    // Same-parent moves are Chrome-native reordering (e.g. dragging within
    // its bookmark manager) and must be ignored per the position model:
    // stored positions are never re-derived from Chrome's own order.
    if (moveInfo.parentId === moveInfo.oldParentId) {
      return;
    }
    void mutex.runExclusive(async () => {
      await removeBookmarkPosition(moveInfo.oldParentId, id);
      const [node] = await chrome.bookmarks.get(id);
      if (node && isBookmark(node)) {
        await placeNewBookmark(moveInfo.parentId, id);
      }
    });
  });

  // "Sort by name" and similar native reorder actions fire this instead of
  // onMoved; same rule applies — same-folder reordering is ignored.
  chrome.bookmarks.onChildrenReordered.addListener(() => {
    // Intentional no-op.
  });

  // Title/url edits don't affect stored grid position; listener kept so
  // other capabilities (e.g. favicon cache invalidation) have a single
  // place to hook in.
  chrome.bookmarks.onChanged.addListener(() => {
    // Intentional no-op for the position layer.
  });
}

/**
 * Subscribes to any chrome.bookmarks structure event — create, remove,
 * move, title/url change, or native reorder — regardless of whether it
 * originated from this extension's own UI or Chrome's native bookmark
 * manager. Used by newtab UI hooks (sidebar folder tree, canvas bookmark
 * list) to refetch their view live, since Chrome delivers these events to
 * every extension context in the profile with no custom messaging needed.
 * Returns an unsubscribe function.
 */
export function subscribeToBookmarkChanges(callback: () => void): () => void {
  chrome.bookmarks.onCreated.addListener(callback);
  chrome.bookmarks.onRemoved.addListener(callback);
  chrome.bookmarks.onMoved.addListener(callback);
  chrome.bookmarks.onChanged.addListener(callback);
  chrome.bookmarks.onChildrenReordered.addListener(callback);
  return () => {
    chrome.bookmarks.onCreated.removeListener(callback);
    chrome.bookmarks.onRemoved.removeListener(callback);
    chrome.bookmarks.onMoved.removeListener(callback);
    chrome.bookmarks.onChanged.removeListener(callback);
    chrome.bookmarks.onChildrenReordered.removeListener(callback);
  };
}
