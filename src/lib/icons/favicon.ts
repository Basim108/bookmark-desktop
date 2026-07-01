/**
 * Builds a favicon URL via the MV3 `_favicon` special page — `chrome://
 * favicon/<url>` is deprecated/restricted under MV3. Requires the
 * `favicon` permission (declared in manifest.config.ts).
 */
export function getFaviconUrl(pageUrl: string, size = 32): string {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", String(size));
  return url.toString();
}
