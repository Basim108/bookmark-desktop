import { createMutex } from "../concurrency/mutex";
import { DEFAULT_GRID_CAPACITY, getNextFreeCell } from "../grid/placement";
import { backfillFolderPositions } from "../grid/seed";
import {
  getFolderPositions,
  removeBookmarkPosition,
  setBookmarkPosition,
} from "../storage/positions";
import { removeBookmarkSettings } from "../storage/bookmarkSettings";
import { removeFolderSettings } from "../storage/folderSettings";
import { deleteIcon } from "../storage/iconDb";
import { isTransferLockRecordHeld } from "../transfer/lockRecord";
import { isBookmark } from "./read";

const mutex = createMutex();

async function placeNewBookmark(folderId: string, bookmarkId: string) {
  const existing = await getFolderPositions(folderId);
  const cell = getNextFreeCell(Object.values(existing), DEFAULT_GRID_CAPACITY);
  await setBookmarkPosition(folderId, bookmarkId, cell);
}

/**
 * Recursively removes stored positions, settings, and any custom-icon blob
 * for a removed node and, if it was a folder, every bookmark/subfolder
 * nested inside it — otherwise this per-item data is orphaned forever in
 * chrome.storage.local/IndexedDB with no way for the user to reclaim it.
 */
async function cleanUpRemovedSubtree(
  node: chrome.bookmarks.BookmarkTreeNode,
  parentId: string,
) {
  if (isBookmark(node)) {
    await Promise.all([
      removeBookmarkPosition(parentId, node.id),
      removeBookmarkSettings(node.id),
      deleteIcon(node.id),
    ]);
    return;
  }
  await Promise.all([removeFolderSettings(node.id), deleteIcon(node.id)]);
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

// Extension-state transfer lock. While held (set from the newtab importer via a
// runtime message, since the importer and these listeners run in different
// contexts), the position/cleanup listeners stand down: a replace-import writes
// all positions/settings itself and deletes everything, so auto-placement and
// per-item cleanup would only fight it.
//
// This flag is only a synchronous fast path. It lives in whichever context ran
// registerBookmarkListeners (the background service worker), so an MV3 teardown
// mid-import resets it to false while the import is still running — and a long
// import spends stretches in IndexedDB writes that don't reset the idle timer.
// The durable record in chrome.storage.session is the authority; see
// isTransferLocked.
let transferImportLocked = false;

/**
 * Whether a state-transfer import is in progress. Checked inside the mutex,
 * immediately before any position/cleanup write, so a worker that restarted
 * mid-import still stands down for the rest of it.
 */
async function isTransferLocked(): Promise<boolean> {
  return transferImportLocked || (await isTransferLockRecordHeld());
}

/** Message the importer sends to toggle the background transfer lock. */
export interface TransferLockMessage {
  type: "transfer:setLock";
  locked: boolean;
}

function isTransferLockMessage(
  message: unknown,
): message is TransferLockMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "transfer:setLock" &&
    typeof (message as { locked?: unknown }).locked === "boolean"
  );
}

/**
 * Wires the chrome.bookmarks listeners that keep stored positions
 * consistent with live bookmark structure changes. Safe to call once per
 * service worker lifetime (e.g. from the background entry point).
 */
export function registerBookmarkListeners(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (isTransferLockMessage(message)) {
      transferImportLocked = message.locked;
      sendResponse({ ok: true });
      return true;
    }
    return undefined;
  });

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
    if (transferImportLocked) {
      return;
    }
    if (!isBookmark(bookmark) || !bookmark.parentId) {
      return;
    }
    if (importInProgress) {
      importTouchedFolders.add(bookmark.parentId);
      return;
    }
    const parentId = bookmark.parentId;
    void mutex.runExclusive(async () => {
      if (await isTransferLocked()) return;
      await placeNewBookmark(parentId, id);
    });
  });

  chrome.bookmarks.onRemoved.addListener((_id, removeInfo) => {
    if (transferImportLocked) {
      return;
    }
    void mutex.runExclusive(async () => {
      if (await isTransferLocked()) return;
      await cleanUpRemovedSubtree(removeInfo.node, removeInfo.parentId);
    });
  });

  chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
    if (transferImportLocked) {
      return;
    }
    // Same-parent moves are Chrome-native reordering (e.g. dragging within
    // its bookmark manager) and must be ignored per the position model:
    // stored positions are never re-derived from Chrome's own order.
    if (moveInfo.parentId === moveInfo.oldParentId) {
      return;
    }
    void mutex.runExclusive(async () => {
      if (await isTransferLocked()) return;
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

const localChangeSubscribers = new Set<() => void>();

// When suspended (during a state-transfer import in this same context), the
// live-refetch subscribers stop firing so the delete/create storm doesn't cause
// a refetch per event; resumeBookmarkSubscribers + forceBookmarkResync catch the
// UI up in a single pass on release. This is the newtab half of the transfer
// lock (the background half is transferImportLocked, reached by runtime message).
let subscribersSuspended = false;

/** Suspends live UI refetches. Idempotent. */
export function suspendBookmarkSubscribers(): void {
  subscribersSuspended = true;
}

/** Resumes live UI refetches. Idempotent — safe to call even if never suspended. */
export function resumeBookmarkSubscribers(): void {
  subscribersSuspended = false;
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
  localChangeSubscribers.add(callback);
  // The raw callback is tracked (for forceBookmarkResync); the guarded wrapper
  // is what actually listens, so it can no-op while subscribers are suspended.
  const guarded = () => {
    if (!subscribersSuspended) {
      callback();
    }
  };
  chrome.bookmarks.onCreated.addListener(guarded);
  chrome.bookmarks.onRemoved.addListener(guarded);
  chrome.bookmarks.onMoved.addListener(guarded);
  chrome.bookmarks.onChanged.addListener(guarded);
  chrome.bookmarks.onChildrenReordered.addListener(guarded);
  return () => {
    localChangeSubscribers.delete(callback);
    chrome.bookmarks.onCreated.removeListener(guarded);
    chrome.bookmarks.onRemoved.removeListener(guarded);
    chrome.bookmarks.onMoved.removeListener(guarded);
    chrome.bookmarks.onChanged.removeListener(guarded);
    chrome.bookmarks.onChildrenReordered.removeListener(guarded);
  };
}

/**
 * Forces every subscribeToBookmarkChanges listener to refetch, without a
 * real chrome.bookmarks event. Used after a chrome.bookmarks.move call is
 * known to have been rejected (e.g. a folder-cycle or protected-root move) —
 * Chrome fires no onMoved event on rejection, so optimistic local UI state
 * (e.g. useSubfolders' immediate removal of the dragged folder) would
 * otherwise be left inconsistent with the real, unchanged bookmark tree
 * until an unrelated structure event happened to resync it.
 */
export function forceBookmarkResync(): void {
  for (const callback of localChangeSubscribers) {
    callback();
  }
}
