import { useState } from "react";
import { FolderTreeNode } from "./FolderTreeNode";
import { useSidebarResize } from "../hooks/useSidebarResize";

interface SidebarProps {
  rootFolders: chrome.bookmarks.BookmarkTreeNode[];
  loading: boolean;
  activeFolderId: string | undefined;
  onSelectFolder: (folderId: string) => void;
  /** Current viewport width, used to pick the sidebar's max-width tier. */
  viewportWidth: number;
  /** Opens the global General Settings window (invoked by the header's hamburger button). */
  onOpenSettings: () => void;
}

export function Sidebar({
  rootFolders,
  loading,
  activeFolderId,
  onSelectFolder,
  viewportWidth,
  onOpenSettings,
}: SidebarProps) {
  const { width, isDragging, startDrag } = useSidebarResize(viewportWidth);
  const [openSettingsFolderId, setOpenSettingsFolderId] = useState<
    string | undefined
  >(undefined);

  const resizeHandle = (
    <div
      className="sidebar-resize-handle"
      onPointerDown={startDrag}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
    />
  );

  // Fixed header band above the scrollable folder tree. Its only control is the
  // hamburger button that opens the global settings window; it is not a folder
  // row (no name, icon, expand toggle, selection, or drag/drop).
  const header = (
    <div className="sidebar-header">
      <button
        type="button"
        className="sidebar-settings-button"
        aria-label="Open settings"
        onClick={onOpenSettings}
      >
        ☰
      </button>
    </div>
  );

  if (loading) {
    return (
      <nav className="sidebar" aria-label="Bookmark folders" style={{ width }}>
        {header}
        <div className="sidebar-scroll-area">
          <p className="sidebar-loading">Loading folders…</p>
        </div>
        {resizeHandle}
      </nav>
    );
  }

  return (
    <nav
      className={isDragging ? "sidebar sidebar--resizing" : "sidebar"}
      aria-label="Bookmark folders"
      style={{ width }}
    >
      {header}
      <div className="sidebar-scroll-area">
        <ul className="folder-tree">
          {rootFolders.map((folder) => (
            <FolderTreeNode
              key={folder.id}
              folder={folder}
              activeFolderId={activeFolderId}
              onSelectFolder={onSelectFolder}
              depth={0}
              openSettingsFolderId={openSettingsFolderId}
              onOpenSettings={setOpenSettingsFolderId}
            />
          ))}
        </ul>
      </div>
      {resizeHandle}
    </nav>
  );
}
