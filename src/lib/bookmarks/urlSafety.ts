/**
 * Bookmarks are Chrome's own store: any page can prompt a user to save a
 * `javascript:`/`data:` bookmarklet, and this extension has no control over
 * what URL strings end up in chrome.bookmarks. Required by
 * openspec/project.md ("Validate URLs before navigation (block
 * `javascript:` etc.)") before navigating the privileged extension page to
 * a bookmark's URL.
 */
const ALLOWED_NAVIGATION_SCHEMES = new Set([
  "http:",
  "https:",
  "file:",
  "ftp:",
]);

export function isSafeNavigationUrl(url: string): boolean {
  try {
    return ALLOWED_NAVIGATION_SCHEMES.has(new URL(url).protocol);
  } catch {
    return false;
  }
}
