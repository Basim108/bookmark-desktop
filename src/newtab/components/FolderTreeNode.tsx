import { useState } from "react";
import { useSubfolders } from "../hooks/useSubfolders";
import { useFolderSettings } from "../hooks/useFolderSettings";
import { setFolderSidebarDisplay } from "../../lib/storage/folderSettings";
import { resolveFolderDisplay } from "../../lib/storage/folderSettings";
import type { FolderSidebarDisplay } from "../../lib/storage/schema";
import { CustomIconImage } from "./CustomIconImage";

interface FolderTreeNodeProps {
  folder: chrome.bookmarks.BookmarkTreeNode;
  activeFolderId: string | undefined;
  onSelectFolder: (folderId: string) => void;
  depth: number;
}

const DISPLAY_OPTIONS: { value: FolderSidebarDisplay; label: string }[] = [
  { value: "label-only", label: "Name only" },
  { value: "icon-only", label: "Icon only" },
  { value: "icon-and-label", label: "Icon + name" },
];

export function FolderTreeNode({
  folder,
  activeFolderId,
  onSelectFolder,
  depth,
}: FolderTreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { folders: subfolders } = useSubfolders(folder.id);
  const { settings, reload } = useFolderSettings(folder.id);

  const display = resolveFolderDisplay(settings);
  const isActive = activeFolderId === folder.id;
  const hasChildren = subfolders.length > 0;

  async function handleDisplayChange(next: FolderSidebarDisplay) {
    await setFolderSidebarDisplay(folder.id, next);
    reload();
  }

  return (
    <li>
      <div
        className={`folder-row${isActive ? " folder-row--active" : ""}`}
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
          type="button"
          className="folder-select"
          onClick={() => onSelectFolder(folder.id)}
          title={display === "icon-only" ? folder.title : undefined}
        >
          {display !== "label-only" && (
            <CustomIconImage itemId={folder.id} alt={folder.title} />
          )}
          {display !== "icon-only" && (
            <span className="folder-label">{folder.title}</span>
          )}
        </button>

        <button
          type="button"
          className="folder-settings-toggle"
          aria-label="Folder display settings"
          onClick={() => setSettingsOpen((value) => !value)}
        >
          ⚙
        </button>
      </div>

      {settingsOpen && (
        <div className="folder-settings-panel" role="group">
          {DISPLAY_OPTIONS.map((option) => (
            <label key={option.value} className="folder-settings-option">
              <input
                type="radio"
                name={`folder-display-${folder.id}`}
                value={option.value}
                checked={settings.sidebarDisplay === option.value}
                disabled={
                  !settings.hasCustomIcon && option.value !== "label-only"
                }
                onChange={() => void handleDisplayChange(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      )}

      {expanded && hasChildren && (
        <ul className="folder-children">
          {subfolders.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              activeFolderId={activeFolderId}
              onSelectFolder={onSelectFolder}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
