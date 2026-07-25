import { isFolder } from "../bookmarks/read";
import { getStorageValue, setStorageValue } from "./local";
import { STORAGE_KEYS } from "./schema";

/**
 * The folder to restore as a newly opened new-tab page's active folder, or
 * undefined when there is nothing usable to restore.
 *
 * The stored value is an opaque Chrome bookmark id, and Chrome reassigns ids
 * per profile (bookmark sync, or restoring a state-transfer export), so a
 * stored id can stop resolving — or resolve to a *bookmark* rather than the
 * folder it originally named. Both are validated here at read time rather than
 * cleaned up on `chrome.bookmarks.onRemoved`: a reassignment fires no removal
 * event locally, so read-time validation is the only check that covers it.
 *
 * A stale value is deliberately left in storage rather than cleared or
 * overwritten with the fallback — see setLastFolderId.
 */
export async function getLastFolderId(): Promise<string | undefined> {
  const storedId = await getStorageValue(STORAGE_KEYS.LAST_FOLDER_ID);
  if (storedId === undefined) return undefined;
  try {
    const [node] = await chrome.bookmarks.get(storedId);
    return node !== undefined && isFolder(node) ? storedId : undefined;
  } catch {
    // chrome.bookmarks.get rejects for an id that no longer exists.
    return undefined;
  }
}

/**
 * Records the folder the user just selected.
 *
 * Call this only for an explicit user selection — never from the restore path
 * and never for a fallback. A tab that fell back because the stored id no
 * longer resolves must not write that fallback back, or simply opening one tab
 * on a profile where ids were reassigned would silently erase the real
 * recorded folder with no way to recover it.
 */
export async function setLastFolderId(folderId: string): Promise<void> {
  await setStorageValue(STORAGE_KEYS.LAST_FOLDER_ID, folderId);
}
