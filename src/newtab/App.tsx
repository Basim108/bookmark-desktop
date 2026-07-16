import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { CollisionDetection, DragEndEvent } from "@dnd-kit/core";

/**
 * Resolve the drop target by the pointer's position first, falling back to
 * rectangle-intersection only when the pointer is over no droppable. The
 * default (rectIntersection alone) targets whichever droppable the dragged
 * element's *rectangle* overlaps most — unreliable when a large bookmark
 * icon (up to 166px) is dragged over the stack of ~22px sidebar folder rows,
 * where the icon rect overlaps several rows and can resolve to the wrong
 * folder even though the cursor is squarely inside the intended one. The
 * fallback preserves forgiving canvas-cell drops (e.g. onto a grid gap).
 */
const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0
    ? pointerCollisions
    : rectIntersection(args);
};
import { Canvas } from "./components/Canvas";
import { Sidebar } from "./components/Sidebar";
import { GeneralSettingsWindow } from "./components/GeneralSettingsWindow";
import { useSubfolders } from "./hooks/useSubfolders";
import { useElementSize } from "./hooks/useElementSize";
import { useCanvasBackground } from "./hooks/useCanvasBackground";
import { moveNodeToFolder } from "../lib/bookmarks/move";
import { resolveCrossFolderDrop } from "../lib/bookmarks/dragResolve";
import { forceBookmarkResync } from "../lib/bookmarks/events";

/** Chrome's bookmark tree root id — parent of the top-level folders (Bookmarks Bar, Other Bookmarks, etc.). */
const ROOT_FOLDER_ID = "0";

export function App() {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Cross-folder drag (bookmark -> sidebar folder, folder -> sidebar folder)
  // is resolved here since it's the one ancestor shared by both the sidebar
  // and the canvas. Within-canvas cell drops are resolved locally by Canvas
  // itself via useDndMonitor.
  async function handleDragEnd(event: DragEndEvent) {
    const action = await resolveCrossFolderDrop(
      String(event.active.id),
      event.active.data.current as
        | { type?: string; sourceFolderId?: string; sourceParentId?: string }
        | undefined,
      event.over?.data.current as
        { type?: string; folderId?: string } | undefined,
    );
    if (!action) return;
    const nodeId =
      action.kind === "move-bookmark" ? action.bookmarkId : action.folderId;
    try {
      await moveNodeToFolder(nodeId, action.destFolderId);
    } catch {
      // chrome.bookmarks.move rejected (e.g. a case resolveCrossFolderDrop's
      // guards didn't anticipate). No onMoved event will fire, so force a
      // resync to correct any optimistic local state (e.g. useSubfolders'
      // synchronous removal of the dragged folder) back to the real,
      // unchanged bookmark tree.
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
  // Tracks only an explicit user override; absent an override, the first
  // root folder is selected. Computed during render rather than synced via
  // an effect, since it's fully derivable from props/state each render.
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(
    undefined,
  );
  const activeFolderId = selectedFolderId ?? rootFolders[0]?.id;
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
        onSelectFolder={setSelectedFolderId}
        viewportWidth={appSize.width}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      {activeFolderId ? (
        <Canvas
          folderId={activeFolderId}
          onLabelFontSizeChange={setLabelFontSize}
          backgroundStyle={canvasBackground.style}
        />
      ) : (
        <p className="canvas-empty">No bookmark folders found.</p>
      )}
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
