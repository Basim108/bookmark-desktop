import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { FolderTreeNode } from "./FolderTreeNode";
import type { OpenFolderWindow } from "./FolderTreeNode";
import { ImportConfirmWindow } from "./ImportConfirmWindow";
import { ImportToast } from "./ImportToast";
import { useSidebarResize } from "../hooks/useSidebarResize";
import { useRootFolderImport } from "../hooks/useRootFolderImport";

/** Nothing expanded — the shape used until a restored folder seeds the tree. */
const NO_EXPANDED_FOLDERS: readonly string[] = [];

interface SidebarProps {
  rootFolders: chrome.bookmarks.BookmarkTreeNode[];
  loading: boolean;
  activeFolderId: string | undefined;
  onSelectFolder: (folderId: string) => void;
  /** Current viewport width, used to pick the sidebar's max-width tier. */
  viewportWidth: number;
  /** Opens the global General Settings window (invoked by the header's hamburger button). */
  onOpenSettings: () => void;
  /**
   * Folders to expand when the tree first mounts — the restored folder's
   * ancestors, so its row is visible. Read once to seed the sidebar's own
   * expansion state; changing it later has no effect, leaving expanding and
   * collapsing entirely under the user's control for the rest of the session.
   */
  initialExpandedIds?: readonly string[] | undefined;
}

export function Sidebar({
  rootFolders,
  loading,
  activeFolderId,
  onSelectFolder,
  viewportWidth,
  onOpenSettings,
  initialExpandedIds = NO_EXPANDED_FOLDERS,
}: SidebarProps) {
  const { width, isDragging, startDrag } = useSidebarResize(viewportWidth);
  // Root-folder import lives here, not in a row: one import at a time must hold
  // across every root, and the toast has to outlive a row re-render — live
  // bookmark sync refetches the tree constantly while an import creates items.
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const openImportFilePicker = useCallback(
    () => importFileInputRef.current?.click(),
    [],
  );
  const importFlow = useRootFolderImport(openImportFilePicker);
  // Exactly one folder window is open at a time across the whole sidebar —
  // either an existing folder's settings or a new-folder draft under a parent.
  const [openWindow, setOpenWindow] = useState<OpenFolderWindow | undefined>(
    undefined,
  );
  // Which folders are expanded, for the whole tree. Held here rather than in
  // each row so the restored folder's ancestors can be opened from outside the
  // rows — a row cannot reveal itself.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(initialExpandedIds),
  );
  // The seed arrives asynchronously (App resolves the restored folder, then
  // walks its ancestors), so it is normally still empty when this component
  // mounts and cannot be applied by the useState initializer alone. Apply it
  // the first time a non-empty seed shows up, exactly once: re-applying it
  // later would re-open ancestors the user had deliberately collapsed. Merging
  // rather than replacing keeps anything expanded in the interim.
  const seeded = useRef(initialExpandedIds.length > 0);
  useEffect(() => {
    if (seeded.current || initialExpandedIds.length === 0) return;
    seeded.current = true;
    setExpandedIds((current) => new Set([...current, ...initialExpandedIds]));
  }, [initialExpandedIds]);

  function setExpanded(folderId: string, expanded: boolean) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (expanded) {
        next.add(folderId);
      } else {
        next.delete(folderId);
      }
      return next;
    });
  }

  function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset before awaiting so re-picking the same file fires change again.
    event.target.value = "";
    if (file) void importFlow.onFileChosen(file);
  }

  /**
   * Rendered outside the `loading` early-return below as well as the main tree,
   * so an import in flight keeps its toast even if the folder tree drops back
   * into its loading state — which it can, since importing churns the very
   * bookmark structure the tree is reading.
   */
  const importSurfaces = (
    <>
      <input
        ref={importFileInputRef}
        type="file"
        accept=".json,application/json"
        aria-label="Import uTab bookmarks file"
        className="folder-settings-window-upload-input"
        onChange={handleImportFileChange}
      />
      {importFlow.state.kind === "confirming" && (
        <ImportConfirmWindow
          folder={importFlow.state.folder}
          onCancel={importFlow.cancelConfirm}
          onChooseFile={importFlow.confirmAndPickFile}
        />
      )}
      {importFlow.state.kind === "running" && (
        <ImportToast progress={importFlow.state.progress} />
      )}
      {importFlow.state.kind === "done" && (
        <ImportToast
          message={importFlow.state.message}
          onDismiss={importFlow.dismissResult}
        />
      )}
    </>
  );

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
        {importSurfaces}
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
              openWindow={openWindow}
              onSetOpenWindow={setOpenWindow}
              expandedIds={expandedIds}
              onSetExpanded={setExpanded}
              onRequestImport={importFlow.requestImport}
              importBusy={importFlow.busy}
            />
          ))}
        </ul>
      </div>
      {resizeHandle}
      {importSurfaces}
    </nav>
  );
}
