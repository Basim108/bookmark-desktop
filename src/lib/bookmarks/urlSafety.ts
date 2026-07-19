/**
 * Bookmarks are Chrome's own store: any page can prompt a user to save a
 * `javascript:`/`data:` bookmarklet, and this extension has no control over
 * what URL strings end up in chrome.bookmarks. Required by
 * openspec/project.md ("Validate URLs before navigation (block
 * `javascript:` etc.)") before navigating the privileged extension page to
 * a bookmark's URL.
 */
/*
 * `file:` and `ftp:` were previously allowed but are deliberately excluded:
 * Chrome removed FTP support in v88, and renderer-initiated navigation from the
 * new-tab page to a `file:` URL is blocked ("Not allowed to load local
 * resource") unless the user separately grants "Allow access to file URLs", so
 * clicking such a bookmark silently does nothing. Accepting a URL the editor
 * will never be able to open is worse than rejecting it at edit time.
 */
const ALLOWED_NAVIGATION_SCHEMES = new Set(["http:", "https:"]);

export function isSafeNavigationUrl(url: string): boolean {
  try {
    return ALLOWED_NAVIGATION_SCHEMES.has(new URL(url).protocol);
  } catch {
    return false;
  }
}
