import { isSafeNavigationUrl } from "./urlSafety";

export type BookmarkEditError = "empty-title" | "unsafe-url";

export interface BookmarkEditResult {
  ok: boolean;
  error?: BookmarkEditError;
}

export interface BookmarkEditChanges {
  title: string;
  url: string;
}

/**
 * Validates then persists a bookmark's title/url via chrome.bookmarks.update.
 * A title that is empty or only whitespace is rejected (Chrome itself would
 * accept it, leaving a nameless bookmark), and a url whose scheme is not on
 * the navigation safe-allowlist is rejected before it can be written into
 * chrome.bookmarks — the same allowlist that gates click-navigation. The
 * stored title is trimmed so a saved name never carries padding whitespace.
 */
export async function updateBookmark(
  id: string,
  changes: BookmarkEditChanges,
): Promise<BookmarkEditResult> {
  const title = changes.title.trim();
  if (title.length === 0) {
    return { ok: false, error: "empty-title" };
  }
  if (!isSafeNavigationUrl(changes.url)) {
    return { ok: false, error: "unsafe-url" };
  }
  await chrome.bookmarks.update(id, { title, url: changes.url });
  return { ok: true };
}

/**
 * Deletes a bookmark from Chrome's own store. The onRemoved listener wired in
 * lib/bookmarks/events.ts cascades cleanup of the bookmark's stored position,
 * settings, and any custom-icon blob, so callers need not clean those up.
 */
export async function removeBookmark(id: string): Promise<void> {
  await chrome.bookmarks.remove(id);
}

/**
 * Validates then persists a folder's title via chrome.bookmarks.update. A
 * folder has no url, so only the title is validated — an empty or
 * whitespace-only title is rejected (the folder-sidebar spec forbids nameless
 * folders), and the stored title is trimmed so a saved name never carries
 * padding whitespace.
 */
export async function updateFolderTitle(
  id: string,
  title: string,
): Promise<BookmarkEditResult> {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "empty-title" };
  }
  await chrome.bookmarks.update(id, { title: trimmed });
  return { ok: true };
}

/**
 * Deletes a folder and its entire subtree from Chrome's own store. Uses
 * removeTree rather than remove because chrome.bookmarks.remove throws on a
 * non-empty folder. The onRemoved listener in lib/bookmarks/events.ts fires
 * once with the whole removed subtree and cascades cleanup of every nested
 * bookmark/subfolder's stored position, settings, and custom-icon blob, so
 * callers need not clean those up.
 */
export async function removeFolder(id: string): Promise<void> {
  await chrome.bookmarks.removeTree(id);
}
