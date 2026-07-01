import type { StorageSchema } from "./schema";

type StorageChanges = Record<string, chrome.storage.StorageChange>;

/**
 * Subscribes to chrome.storage.local changes for a specific set of keys —
 * the mechanism that propagates layout/settings edits made in one open
 * new-tab page live to every other open one, since Chrome delivers this
 * event to every extension context in the profile. Returns an unsubscribe
 * function.
 */
export function onStorageKeysChanged(
  keys: (keyof StorageSchema)[],
  callback: (changes: StorageChanges) => void,
): () => void {
  function listener(changes: StorageChanges, areaName: string) {
    if (areaName !== "local") return;
    if (keys.some((key) => key in changes)) {
      callback(changes);
    }
  }
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
