import { useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useSubfolders } from "../hooks/useSubfolders";
import { useFolderSettings } from "../hooks/useFolderSettings";
import { DEFAULT_FOLDER_ICON_KEY } from "../../lib/storage/defaultFolderIcon";
import { CustomIconImage } from "./CustomIconImage";
import { FolderSettingsWindow } from "./FolderSettingsWindow";

interface FolderTreeNodeProps {
  folder: chrome.bookmarks.BookmarkTreeNode;
  activeFolderId: string | undefined;
  onSelectFolder: (folderId: string) => void;
  depth: number;
  /** Id of the folder whose settings window is currently open across the whole sidebar, or undefined if none is. */
  openSettingsFolderId: string | undefined;
  /** Opens this folder's settings window (pass its id) or closes whichever one is open (pass undefined). Lifted to Sidebar so only one window is ever open at a time. */
  onOpenSettings: (folderId: string | undefined) => void;
}

export function FolderTreeNode({
  folder,
  activeFolderId,
  onSelectFolder,
  depth,
  openSettingsFolderId,
  onOpenSettings,
}: FolderTreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  // Chrome's protected top-level folders (Bookmarks Bar, Other Bookmarks,
  // Mobile Bookmarks) are always the sidebar's depth-0 rows. They are not
  // editable (no settings gear) and not draggable, but remain drop targets.
  const isRoot = depth === 0;
  const settingsOpen = !isRoot && openSettingsFolderId === folder.id;
  const { folders: subfolders } = useSubfolders(folder.id);
  const { settings, reload, version } = useFolderSettings(folder.id);

  // A non-root folder row is both a drag source (moving it to another folder)
  // and a drop target (accepting a dragged bookmark or another dragged
  // folder) — the same node uses both hooks, combining their refs below. The
  // draggable hook is always called (hooks can't be conditional), but its
  // listeners/attributes/transform are only wired up when the row isn't a
  // root, so root rows never initiate a drag.
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: folder.id,
    data: {
      type: "folder",
      folderId: folder.id,
      sourceParentId: folder.parentId,
    },
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: folder.id,
    data: { type: "folder", folderId: folder.id },
  });
  function setFolderRowRef(node: HTMLButtonElement | null) {
    if (!isRoot) {
      setDragRef(node);
    }
    setDropRef(node);
  }

  // Every folder row shows an icon and its name. A folder with a custom
  // uploaded icon renders that icon (keyed by its own id); one without renders
  // the single shared default folder icon.
  const iconKey = settings.hasCustomIcon ? folder.id : DEFAULT_FOLDER_ICON_KEY;
  const isActive = activeFolderId === folder.id;
  const hasChildren = subfolders.length > 0;

  return (
    <li>
      <div
        className={`folder-row${isActive ? " folder-row--active" : ""}${isOver ? " folder-row--over" : ""}`}
        style={{ paddingLeft: depth * 16 }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="folder-expand-toggle"
            aria-label={expanded ? "Collapse folder" : "Expand folder"}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="folder-expand-spacer" />
        )}

        <button
          ref={setFolderRowRef}
          type="button"
          className={`folder-select${!isRoot && isDragging ? " folder-select--dragging" : ""}`}
          onClick={() => onSelectFolder(folder.id)}
          style={
            isRoot
              ? undefined
              : { transform: CSS.Translate.toString(transform) }
          }
          {...(isRoot ? {} : listeners)}
          {...(isRoot ? {} : attributes)}
        >
          {/* The row always shows the name, so the icon is decorative
              (empty alt) — it neither doubles the button's accessible name
              nor needs its own announcement. */}
          <CustomIconImage itemId={iconKey} alt="" version={version} />
          <span className="folder-label">{folder.title}</span>
        </button>

        {!isRoot && (
          <button
            type="button"
            className="folder-settings-toggle"
            aria-label="Folder settings"
            onClick={() => onOpenSettings(settingsOpen ? undefined : folder.id)}
          >
            ⚙
          </button>
        )}

        {settingsOpen && (
          <FolderSettingsWindow
            folder={folder}
            settings={settings}
            iconVersion={version}
            onSaved={reload}
            onClose={() => onOpenSettings(undefined)}
          />
        )}
      </div>

      {expanded && hasChildren && (
        <ul className="folder-children">
          {subfolders.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              activeFolderId={activeFolderId}
              onSelectFolder={onSelectFolder}
              depth={depth + 1}
              openSettingsFolderId={openSettingsFolderId}
              onOpenSettings={onOpenSettings}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
