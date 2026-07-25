import { useBookmarkSettings } from "../hooks/useBookmarkSettings";
import { BookmarkIconContent } from "./BookmarkIconContent";

interface DraggedBookmarkOverlayProps {
  bookmark: chrome.bookmarks.BookmarkTreeNode;
  size: number;
}

/**
 * The dragged bookmark's visual, rendered inside dnd-kit's `DragOverlay`.
 * Because the overlay is portaled outside the page grid, it survives the
 * source page unmounting during a drag-to-edge auto-advance — the fix for
 * the dragged icon being lost when the page flips. Reuses
 * `BookmarkIconContent` so it matches the in-grid icon.
 */
export function DraggedBookmarkOverlay({
  bookmark,
  size,
}: DraggedBookmarkOverlayProps) {
  const { settings, version } = useBookmarkSettings(bookmark.id);
  return (
    <div
      className="bookmark-icon bookmark-icon--overlay"
      style={{ width: size, height: size }}
    >
      <BookmarkIconContent
        bookmark={bookmark}
        size={size}
        settings={settings}
        version={version}
      />
    </div>
  );
}
