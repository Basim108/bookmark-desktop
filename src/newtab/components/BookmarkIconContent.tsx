import type { BookmarkSettings } from "../../lib/storage/schema";
import { CustomIconImage } from "./CustomIconImage";
import { FaviconImage } from "./FaviconImage";

interface BookmarkIconContentProps {
  bookmark: chrome.bookmarks.BookmarkTreeNode;
  size: number;
  settings: BookmarkSettings;
  /** Bumped on reload so CustomIconImage refetches after an icon upload/removal. */
  version: number;
}

/**
 * The visual body of a bookmark icon (image + optional label), shared by the
 * in-grid `BookmarkIcon` and the `DraggedBookmarkOverlay` so the dragged
 * visual matches the icon it was lifted from exactly.
 */
export function BookmarkIconContent({
  bookmark,
  size,
  settings,
  version,
}: BookmarkIconContentProps) {
  const tooltipOnly = settings.labelDisplay === "tooltip";
  return (
    <>
      {settings.hasCustomIcon ? (
        <CustomIconImage
          itemId={bookmark.id}
          alt={bookmark.title}
          version={version}
        />
      ) : bookmark.url ? (
        <FaviconImage url={bookmark.url} size={size} alt={bookmark.title} />
      ) : (
        <span className="favicon-fallback" aria-hidden="true" />
      )}
      {!tooltipOnly && (
        <span className="bookmark-icon-label">{bookmark.title}</span>
      )}
    </>
  );
}
