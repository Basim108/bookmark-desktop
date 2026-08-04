import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useSubfolders } from "../hooks/useSubfolders";
import { useFolderSettings } from "../hooks/useFolderSettings";
import { DEFAULT_FOLDER_ICON_KEY } from "../../lib/storage/defaultFolderIcon";
import { CustomIconImage } from "./CustomIconImage";
import { FolderDropGap } from "./FolderDropGap";
import { FolderSettingsWindow } from "./FolderSettingsWindow";
import type { ImportDestination } from "../hooks/useUtabImport";

/**
 * Which folder window is open across the whole sidebar, if any. Lifted to
 * Sidebar so exactly one window (an existing folder's settings, or a new-folder
 * draft under some parent) is ever open at a time — opening either closes the
 * other.
 */
export type OpenFolderWindow =
  { kind: "edit"; folderId: string } | { kind: "add"; parentId: string };

interface FolderTreeNodeProps {
  folder: chrome.bookmarks.BookmarkTreeNode;
  activeFolderId: string | undefined;
  onSelectFolder: (folderId: string) => void;
  depth: number;
  /** The window currently open across the whole sidebar, or undefined if none is. */
  openWindow: OpenFolderWindow | undefined;
  /** Opens a folder window (edit this folder or add a subfolder under it) or closes whichever one is open (pass undefined). Lifted to Sidebar so only one window is ever open at a time. */
  onSetOpenWindow: (next: OpenFolderWindow | undefined) => void;
  /** Ids of every expanded folder across the whole tree. Lifted to Sidebar so a restored folder's ancestors can be expanded from outside the rows themselves. */
  expandedIds: Set<string>;
  /** Expands (true) or collapses (false) one folder. Takes an explicit target state rather than toggling, so callers that must *ensure* a row is open — revealing a newly created subfolder — cannot accidentally close an already-open one. */
  onSetExpanded: (folderId: string, expanded: boolean) => void;
  /** Starts the root rows' import flow. Root rows only; the flow itself is owned by Sidebar so one import at a time can be enforced across every root, and so its toast outlives this row's re-render. */
  onRequestImport: (destination: ImportDestination) => void;
  /** True while any import is in flight, which disables the import button on every root row. */
  importBusy: boolean;
  /** The subfolder rendered immediately above this row among its siblings, if any. Lets this row's "insert before me" gap tell synchronously whether it sits adjacent to the folder being dragged (dropping there would change nothing). */
  previousSiblingId?: string | undefined;
}

export function FolderTreeNode({
  folder,
  activeFolderId,
  onSelectFolder,
  depth,
  openWindow,
  onSetOpenWindow,
  expandedIds,
  onSetExpanded,
  onRequestImport,
  importBusy,
  previousSiblingId,
}: FolderTreeNodeProps) {
  const expanded = expandedIds.has(folder.id);
  // Chrome's protected top-level folders (Bookmarks Bar, Other Bookmarks,
  // Mobile Bookmarks) are always the sidebar's depth-0 rows. They are not
  // editable (no settings gear) and not draggable, but remain drop targets.
  // They can still hold subfolders, so they do get the add-subfolder button.
  const isRoot = depth === 0;
  const settingsOpen =
    !isRoot && openWindow?.kind === "edit" && openWindow.folderId === folder.id;
  const draftOpen =
    openWindow?.kind === "add" && openWindow.parentId === folder.id;
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
        {/* "Insert before this row", anchored to the row's top edge. Every gap
            is a *before* slot: the top of a row always immediately follows the
            end of everything above it, subtree included, so the indicator can
            never point at a position the folder won't actually land in — which
            an "after this row" gap would do the moment the row above is
            expanded. Root rows are skipped; Chrome refuses to move its
            protected top-level folders, so a gap among them is never live. */}
        {!isRoot && (
          <FolderDropGap
            parentId={folder.parentId}
            slot={{ kind: "before", subfolderId: folder.id }}
            previousSubfolderId={previousSiblingId}
            depth={depth}
          />
        )}

        {hasChildren ? (
          <button
            type="button"
            className="folder-expand-toggle"
            aria-label={expanded ? "Collapse folder" : "Expand folder"}
            onClick={() => onSetExpanded(folder.id, !expanded)}
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

        {/* Root rows only — the inverse of the gear's gate below. Roots cannot
            be edited (Chrome refuses bookmarks.update on them), but importing
            only creates children inside one, so it is a valid operation the
            gear's absence was incidentally blocking. Placed before the
            add-subfolder button, per the requested [import] [+] order. */}
        {isRoot && (
          <button
            type="button"
            className="folder-import-utab"
            aria-label="Import uTab Bookmarks"
            title="Import uTab Bookmarks"
            disabled={importBusy}
            onClick={() =>
              onRequestImport({ id: folder.id, title: folder.title })
            }
          >
            ⭳
          </button>
        )}

        <button
          type="button"
          className={`folder-add-subfolder${draftOpen ? " folder-add-subfolder--open" : ""}`}
          aria-label="Add subfolder"
          title="Create Folder"
          onClick={() =>
            onSetOpenWindow(
              draftOpen ? undefined : { kind: "add", parentId: folder.id },
            )
          }
        >
          +
        </button>

        {!isRoot && (
          <button
            type="button"
            className={`folder-settings-toggle${settingsOpen ? " folder-settings-toggle--open" : ""}`}
            aria-label="Folder settings"
            title="Folder Settings"
            onClick={() =>
              onSetOpenWindow(
                settingsOpen
                  ? undefined
                  : { kind: "edit", folderId: folder.id },
              )
            }
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
            onClose={() => onSetOpenWindow(undefined)}
          />
        )}

        {draftOpen && (
          <FolderSettingsWindow
            createParentId={folder.id}
            // Reveal the newly created child by expanding this row; the
            // subfolder list refreshes itself via live bookmark sync. Expands
            // unconditionally rather than toggling, so saving under a row that
            // was already open leaves it open.
            onSaved={() => onSetExpanded(folder.id, true)}
            onClose={() => onSetOpenWindow(undefined)}
          />
        )}
      </div>

      {expanded && hasChildren && (
        <ul className="folder-children">
          {subfolders.map((child, index) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              activeFolderId={activeFolderId}
              onSelectFolder={onSelectFolder}
              depth={depth + 1}
              openWindow={openWindow}
              onSetOpenWindow={onSetOpenWindow}
              expandedIds={expandedIds}
              onSetExpanded={onSetExpanded}
              onRequestImport={onRequestImport}
              importBusy={importBusy}
              previousSiblingId={subfolders[index - 1]?.id}
            />
          ))}
          {/* "Insert at the end of this folder's children". Sits after the last
              <li>, so it lands below that sibling's entire subtree rather than
              directly under its row. Zero-height, so it adds no layout. */}
          <li className="folder-drop-gap-slot">
            <FolderDropGap
              parentId={folder.id}
              slot={{ kind: "end" }}
              previousSubfolderId={subfolders[subfolders.length - 1]?.id}
              depth={depth + 1}
            />
          </li>
        </ul>
      )}
    </li>
  );
}
