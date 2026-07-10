import { FolderTreeNode } from "./FolderTreeNode";
import { useSidebarResize } from "../hooks/useSidebarResize";

interface SidebarProps {
  rootFolders: chrome.bookmarks.BookmarkTreeNode[];
  loading: boolean;
  activeFolderId: string | undefined;
  onSelectFolder: (folderId: string) => void;
}

export function Sidebar({
  rootFolders,
  loading,
  activeFolderId,
  onSelectFolder,
}: SidebarProps) {
  const { width, isDragging, startDrag } = useSidebarResize();

  const resizeHandle = (
    <div
      className="sidebar-resize-handle"
      onPointerDown={startDrag}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
    />
  );

  if (loading) {
    return (
      <nav className="sidebar" aria-label="Bookmark folders" style={{ width }}>
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
      <div className="sidebar-scroll-area">
        <ul className="folder-tree">
          {rootFolders.map((folder) => (
            <FolderTreeNode
              key={folder.id}
              folder={folder}
              activeFolderId={activeFolderId}
              onSelectFolder={onSelectFolder}
              depth={0}
            />
          ))}
        </ul>
      </div>
      {resizeHandle}
    </nav>
  );
}
