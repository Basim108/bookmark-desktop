import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";

interface BookmarkIconProps {
  bookmark: chrome.bookmarks.BookmarkTreeNode;
  size: number;
}

/**
 * Placeholder visual only — real favicon/custom-icon rendering is
 * implemented in Group 7. Clicking navigates the current tab, dragging
 * repositions it (see Canvas's DndContext), per the canvas requirements.
 */
export function BookmarkIcon({ bookmark, size }: BookmarkIconProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: bookmark.id });

  function handleClick() {
    if (bookmark.url) {
      window.location.assign(bookmark.url);
    }
  }

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`bookmark-icon${isDragging ? " bookmark-icon--dragging" : ""}`}
      style={{
        width: size,
        height: size,
        transform: CSS.Translate.toString(transform),
      }}
      onClick={handleClick}
      {...listeners}
      {...attributes}
    >
      <span className="bookmark-icon-placeholder" aria-hidden="true" />
      <span className="bookmark-icon-label">{bookmark.title}</span>
    </button>
  );
}
