import { FolderTreeNode } from "./FolderTreeNode";

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
  if (loading) {
    return (
      <nav className="sidebar" aria-label="Bookmark folders">
        <p className="sidebar-loading">Loading folders…</p>
      </nav>
    );
  }

  return (
    <nav className="sidebar" aria-label="Bookmark folders">
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
    </nav>
  );
}
