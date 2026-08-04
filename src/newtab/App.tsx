import { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { collisionDetection } from "./collisionDetection";
import { Canvas } from "./components/Canvas";
import { Sidebar } from "./components/Sidebar";
import { GeneralSettingsWindow } from "./components/GeneralSettingsWindow";
import { useSubfolders } from "./hooks/useSubfolders";
import { useElementSize } from "./hooks/useElementSize";
import { useCanvasBackground } from "./hooks/useCanvasBackground";
import {
  moveNodeToFolder,
  reorderFolderWithinParent,
} from "../lib/bookmarks/move";
import { resolveCrossFolderDrop } from "../lib/bookmarks/dragResolve";
import type {
  DraggedItemData,
  FolderDropData,
} from "../lib/bookmarks/dragResolve";
import { forceBookmarkResync } from "../lib/bookmarks/events";
import { getFolderAncestorChain } from "../lib/bookmarks/read";
import { getLastFolderId, setLastFolderId } from "../lib/storage/lastFolder";

/** Chrome's bookmark tree root id — parent of the top-level folders (Bookmarks Bar, Other Bookmarks, etc.). */
const ROOT_FOLDER_ID = "0";

/**
 * Restoring the last opened folder is asynchronous, so "not yet known" and
 * "known to be nothing" must be distinguishable: treating both as `undefined`
 * would paint the first root folder's canvas for a frame and then swap it for
 * the restored one, on the surface users see most often.
 */
type Restoration =
  | { status: "restoring" }
  | {
      status: "restored";
      /** The folder to open, or undefined to fall back to the first root folder. */
      folderId: string | undefined;
      /** The restored folder's ancestors, to expand so its row is visible. */
      expandedIds: readonly string[];
    };

const RESTORING: Restoration = { status: "restoring" };
const RESTORED_NOTHING: Restoration = {
  status: "restored",
  folderId: undefined,
  expandedIds: [],
};

export function App() {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Every sidebar drag (bookmark -> folder row, folder -> folder row, folder ->
  // reorder gap) is resolved here, the one ancestor shared by both the sidebar
  // and the canvas. Within-canvas cell drops are resolved locally by Canvas
  // itself via useDndMonitor.
  async function handleDragEnd(event: DragEndEvent) {
    const action = await resolveCrossFolderDrop(
      String(event.active.id),
      event.active.data.current as DraggedItemData | undefined,
      event.over?.data.current as FolderDropData | undefined,
    );
    if (!action) return;
    try {
      if (action.kind === "reorder-folder") {
        await reorderFolderWithinParent(
          action.folderId,
          action.parentId,
          action.index,
        );
      } else {
        const nodeId =
          action.kind === "move-bookmark" ? action.bookmarkId : action.folderId;
        await moveNodeToFolder(nodeId, action.destFolderId);
      }
    } catch {
      // chrome.bookmarks.move rejected (e.g. a case resolveCrossFolderDrop's
      // guards didn't anticipate). No onMoved event will fire, so force a
      // resync to bring the sidebar back in step with the real, unchanged
      // bookmark tree.
      forceBookmarkResync();
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragEnd={handleDragEnd}
    >
      <AppContent />
    </DndContext>
  );
}

function AppContent() {
  const { folders: rootFolders, loading } = useSubfolders(ROOT_FOLDER_ID);
  // Tracks only an explicit user override for this tab; absent an override,
  // the restored folder (else the first root folder) is selected. Computed
  // during render rather than synced via an effect, since it's fully derivable
  // from state each render.
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(
    undefined,
  );
  const [restoration, setRestoration] = useState<Restoration>(RESTORING);
  // Read once, on mount. Deliberately *not* subscribed to storage changes:
  // the last opened folder is applied only when a page loads, so selecting a
  // folder in one tab never re-navigates any other open tab.
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      const folderId = await getLastFolderId();
      if (folderId === undefined) {
        if (!cancelled) setRestoration(RESTORED_NOTHING);
        return;
      }
      // getFolderAncestorChain starts with the folder itself; drop it so the
      // restored folder is revealed without its own children being unfolded.
      const expandedIds = (await getFolderAncestorChain(folderId)).slice(1);
      if (!cancelled) {
        setRestoration({ status: "restored", folderId, expandedIds });
      }
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const restored = restoration.status === "restored";
  const activeFolderId =
    selectedFolderId ??
    (restoration.status === "restored"
      ? (restoration.folderId ?? rootFolders[0]?.id)
      : undefined);
  // The canvas waits for both the folder tree and the restore; the sidebar
  // keeps rendering on its own `loading` alone, so it appears no later than
  // it did before restoration existed.
  const canvasReady = restored && !loading;

  function handleSelectFolder(folderId: string) {
    setSelectedFolderId(folderId);
    // Only an explicit user selection is recorded — never the restore path and
    // never a fallback, so a tab that fell back because the stored id no longer
    // resolves cannot overwrite the real recorded folder.
    void setLastFolderId(folderId);
  }
  // .app spans the full window width as an ordinary block-level flex
  // container, so measuring it doubles as viewport-width tracking for the
  // sidebar's max-width tiers, reusing the same ResizeObserver pattern
  // useGridLayout already uses for the canvas instead of a window listener.
  const { ref: appRef, size: appSize } = useElementSize<HTMLDivElement>();
  // Global canvas background (applied to .canvas only), plus the open state for
  // the General Settings window. Lifted here (rather than inside Sidebar) so the
  // window and the canvas share one background source, and the window can mount
  // above both regions.
  const canvasBackground = useCanvasBackground();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Mirrors the canvas's own tier-resolved label font-size (reported by
  // Canvas, which measures itself independently of .app/sidebar width) so
  // the sidebar's folder labels can share it via inheritance. Defaults to
  // the smallest tier's value, matching resolveTier's own first branch, so
  // the CSS variable is never unset before a canvas has mounted/reported.
  const [labelFontSize, setLabelFontSize] = useState("0.75rem");

  return (
    <div
      className="app"
      ref={appRef}
      style={{ "--label-font-size": labelFontSize } as React.CSSProperties}
    >
      <Sidebar
        rootFolders={rootFolders}
        loading={loading}
        activeFolderId={activeFolderId}
        onSelectFolder={handleSelectFolder}
        viewportWidth={appSize.width}
        onOpenSettings={() => setSettingsOpen(true)}
        initialExpandedIds={
          restoration.status === "restored"
            ? restoration.expandedIds
            : undefined
        }
      />
      {canvasReady &&
        (activeFolderId ? (
          <Canvas
            folderId={activeFolderId}
            onLabelFontSizeChange={setLabelFontSize}
            backgroundStyle={canvasBackground.style}
          />
        ) : (
          <p className="canvas-empty">No bookmark folders found.</p>
        ))}
      {settingsOpen && (
        <GeneralSettingsWindow
          background={canvasBackground.background}
          savedBackgroundUrl={canvasBackground.backgroundUrl}
          onSaved={canvasBackground.reload}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
