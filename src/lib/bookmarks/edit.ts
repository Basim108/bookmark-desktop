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
