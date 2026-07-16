import { useState } from "react";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import { useBookmarkSettings } from "../hooks/useBookmarkSettings";
import { isSafeNavigationUrl } from "../../lib/bookmarks/urlSafety";
import { CustomIconImage } from "./CustomIconImage";
import { FaviconImage } from "./FaviconImage";
import { EditBookmarkWindow } from "./EditBookmarkWindow";

interface BookmarkIconProps {
  bookmark: chrome.bookmarks.BookmarkTreeNode;
  size: number;
  folderId: string;
}

/**
 * Clicking navigates the current tab; dragging repositions it within the
 * canvas or moves it to another folder if dropped on a sidebar folder row
 * (see App's shared DndContext). Icon is the bookmark's custom upload if
 * set, else its favicon, else a generic fallback. The gear button opens the
 * centered Edit Bookmark window for this bookmark (icon, name, URL, label
 * visibility, removal).
 */
export function BookmarkIcon({ bookmark, size, folderId }: BookmarkIconProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: bookmark.id,
      data: { type: "bookmark", sourceFolderId: folderId },
    });
  const { settings, reload, version } = useBookmarkSettings(bookmark.id);
  const [editing, setEditing] = useState(false);
  const tooltipOnly = settings.labelDisplay === "tooltip";

  function handleClick() {
    if (bookmark.url && isSafeNavigationUrl(bookmark.url)) {
      window.location.assign(bookmark.url);
    }
  }

  return (
    <div
      className="bookmark-icon-wrapper"
      style={{ width: size, height: size }}
    >
      <button
        ref={setNodeRef}
        type="button"
        className={`bookmark-icon${isDragging ? " bookmark-icon--dragging" : ""}`}
        style={{ transform: CSS.Translate.toString(transform) }}
        onClick={handleClick}
        title={tooltipOnly ? bookmark.title : undefined}
        {...listeners}
        {...attributes}
      >
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
      </button>

      <button
        type="button"
        className="bookmark-icon-settings-toggle"
        aria-label={`Edit ${bookmark.title}`}
        onClick={() => setEditing(true)}
      >
        ⚙
      </button>

      {editing && (
        <EditBookmarkWindow
          bookmark={bookmark}
          settings={settings}
          iconVersion={version}
          onSaved={reload}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
