import { useState } from "react";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import { useBookmarkSettings } from "../hooks/useBookmarkSettings";
import {
  setBookmarkHasCustomIcon,
  setBookmarkLabelDisplay,
} from "../../lib/storage/bookmarkSettings";
import { isSafeNavigationUrl } from "../../lib/bookmarks/urlSafety";
import type { BookmarkLabelDisplay } from "../../lib/storage/schema";
import { CustomIconImage } from "./CustomIconImage";
import { FaviconImage } from "./FaviconImage";
import { IconUploadControls } from "./IconUploadControls";

interface BookmarkIconProps {
  bookmark: chrome.bookmarks.BookmarkTreeNode;
  size: number;
  folderId: string;
}

const LABEL_DISPLAY_OPTIONS: {
  value: BookmarkLabelDisplay;
  label: string;
}[] = [
  { value: "under-icon", label: "Show under icon" },
  { value: "tooltip", label: "Tooltip only" },
];

/**
 * Clicking navigates the current tab; dragging repositions it within the
 * canvas or moves it to another folder if dropped on a sidebar folder row
 * (see App's shared DndContext). Icon is the bookmark's custom upload if
 * set, else its favicon, else a generic fallback. The gear button opens a
 * panel for this bookmark's independent label-display and custom-icon
 * settings.
 */
export function BookmarkIcon({ bookmark, size, folderId }: BookmarkIconProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: bookmark.id,
      data: { type: "bookmark", sourceFolderId: folderId },
    });
  const { settings, reload, version } = useBookmarkSettings(bookmark.id);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const tooltipOnly = settings.labelDisplay === "tooltip";

  function handleClick() {
    if (bookmark.url && isSafeNavigationUrl(bookmark.url)) {
      window.location.assign(bookmark.url);
    }
  }

  async function handleLabelDisplayChange(next: BookmarkLabelDisplay) {
    await setBookmarkLabelDisplay(bookmark.id, next);
    reload();
  }

  async function handleIconChange(hasCustomIcon: boolean) {
    await setBookmarkHasCustomIcon(bookmark.id, hasCustomIcon);
    reload();
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
        aria-label={`${bookmark.title} icon settings`}
        onClick={() => setSettingsOpen((value) => !value)}
      >
        ⚙
      </button>

      {settingsOpen && (
        <div className="bookmark-icon-settings-panel" role="group">
          {LABEL_DISPLAY_OPTIONS.map((option) => (
            <label key={option.value} className="bookmark-settings-option">
              <input
                type="radio"
                name={`bookmark-label-display-${bookmark.id}`}
                value={option.value}
                checked={settings.labelDisplay === option.value}
                onChange={() => void handleLabelDisplayChange(option.value)}
              />
              {option.label}
            </label>
          ))}
          <IconUploadControls
            itemId={bookmark.id}
            hasCustomIcon={settings.hasCustomIcon}
            onChange={(hasCustomIcon) => void handleIconChange(hasCustomIcon)}
          />
        </div>
      )}
    </div>
  );
}
