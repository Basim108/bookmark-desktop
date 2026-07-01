interface BookmarkIconProps {
  bookmark: chrome.bookmarks.BookmarkTreeNode;
  size: number;
}

/**
 * Placeholder visual only — real favicon/custom-icon rendering is
 * implemented in Group 7. Clicking navigates the current tab, per the
 * canvas display requirement.
 */
export function BookmarkIcon({ bookmark, size }: BookmarkIconProps) {
  function handleClick() {
    if (bookmark.url) {
      window.location.assign(bookmark.url);
    }
  }

  return (
    <button
      type="button"
      className="bookmark-icon"
      style={{ width: size, height: size }}
      onClick={handleClick}
    >
      <span className="bookmark-icon-placeholder" aria-hidden="true" />
      <span className="bookmark-icon-label">{bookmark.title}</span>
    </button>
  );
}
