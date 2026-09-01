import { useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { useBookmarkSettings } from "../hooks/useBookmarkSettings";
import { isSafeNavigationUrl } from "../../lib/bookmarks/urlSafety";
import { BookmarkIconContent } from "./BookmarkIconContent";
import { EditBookmarkWindow } from "./EditBookmarkWindow";
import { BookmarkActionMenu } from "./BookmarkActionMenu";
import {
  BookmarkFolderPickerWindow,
  type BookmarkFolderOperation,
} from "./BookmarkFolderPickerWindow";
import { getFolderTree } from "../../lib/bookmarks/read";
import {
  projectFolderTree,
  type FolderPickerEntry,
} from "../../lib/bookmarks/folderPicker";
import { copyBookmarkToFolder } from "../../lib/bookmarks/copy";
import { moveNodeToFolder } from "../../lib/bookmarks/move";

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
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: bookmark.id,
    data: { type: "bookmark", sourceFolderId: folderId },
  });
  const { settings, reload, version } = useBookmarkSettings(bookmark.id);
  const gearRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [operation, setOperation] = useState<BookmarkFolderOperation>();
  const [folders, setFolders] = useState<FolderPickerEntry[]>([]);
  const tooltipOnly = settings.labelDisplay === "tooltip";

  function handleClick() {
    if (bookmark.url && isSafeNavigationUrl(bookmark.url)) {
      window.location.assign(bookmark.url);
    }
  }

  async function openPicker(nextOperation: BookmarkFolderOperation) {
    setMenuOpen(false);
    setFolders(projectFolderTree(await getFolderTree()));
    setOperation(nextOperation);
  }

  async function confirmDestination(destinationFolderId: string) {
    if (operation === "copy") {
      const result = await copyBookmarkToFolder(bookmark, destinationFolderId);
      if (!result.ok) throw new Error(result.error);
    } else {
      await moveNodeToFolder(bookmark.id, destinationFolderId);
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
        onClick={handleClick}
        title={tooltipOnly ? bookmark.title : undefined}
        {...listeners}
        {...attributes}
      >
        <BookmarkIconContent
          bookmark={bookmark}
          size={size}
          settings={settings}
          version={version}
        />
      </button>

      <button
        ref={gearRef}
        type="button"
        className={`bookmark-icon-settings-toggle${menuOpen ? " is-open" : ""}`}
        aria-label={`Actions for ${bookmark.title}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        ⚙
      </button>

      {menuOpen && (
        <BookmarkActionMenu
          anchorRef={gearRef}
          onCopy={() => void openPicker("copy")}
          onMove={() => void openPicker("move")}
          onSettings={() => {
            setMenuOpen(false);
            setEditing(true);
          }}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {operation && (
        <BookmarkFolderPickerWindow
          operation={operation}
          bookmarkTitle={bookmark.title}
          sourceFolderId={folderId}
          folders={folders}
          onConfirm={confirmDestination}
          onClose={() => setOperation(undefined)}
        />
      )}

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
