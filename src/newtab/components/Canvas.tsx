import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { DragOverlay, useDndContext, useDndMonitor } from "@dnd-kit/core";
import type {
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { resolveDrop } from "../../lib/grid/dragDrop";
import { GRID_GAP, GRID_PADDING } from "../../lib/grid/sizing";
import { useGridLayout } from "../hooks/useGridLayout";
import { useEdgePagination } from "../hooks/useEdgePagination";
import { BookmarkIcon } from "./BookmarkIcon";
import { DraggedBookmarkOverlay } from "./DraggedBookmarkOverlay";
import { GridCell } from "./GridCell";

interface CanvasProps {
  folderId: string;
  /** Reports the canvas's current tier label font-size upward whenever it changes, so an ancestor can apply it as a shared CSS variable (see App). */
  onLabelFontSizeChange?: (labelFontSize: string) => void;
  /** Background-image style (image + size/position per fit) applied to the canvas area only. Empty when no background is set. */
  backgroundStyle?: CSSProperties;
}

// Cell droppable ids are page-qualified because every page's grid is mounted
// at once (only the current one is visible): row-col alone would collide
// across pages, and encoding the page lets a cross-page drop read its
// destination page straight off the cell it landed on.
function cellKey(page: number, row: number, col: number): string {
  return `${page}-${row}-${col}`;
}

function parseCellKey(
  key: string,
): { page: number; row: number; col: number } | null {
  const match = /^(\d+)-(\d+)-(\d+)$/.exec(key);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  return {
    page: Number(match[1]),
    row: Number(match[2]),
    col: Number(match[3]),
  };
}

export function Canvas({
  folderId,
  onLabelFontSizeChange,
  backgroundStyle,
}: CanvasProps) {
  const {
    containerRef,
    capacity,
    pages,
    bookmarksById,
    iconSize,
    labelFontSize,
    loading,
    currentPage,
    setCurrentPage,
    moveBookmarks,
  } = useGridLayout(folderId);

  useEffect(() => {
    onLabelFontSizeChange?.(labelFontSize);
  }, [labelFontSize, onLabelFontSizeChange]);

  // When the page changes mid-drag (drag-to-edge auto-advance), the newly
  // shown page's cells need their droppable rects re-measured — dnd-kit
  // measures droppables at drag start and doesn't re-measure them when a
  // descendant's state (currentPage) flips one page from hidden to visible.
  // Without this, a drop on the advanced-to page resolves to no cell.
  const { measureDroppableContainers } = useDndContext();
  useEffect(() => {
    // Empty id list re-measures every droppable (matches dnd-kit's own
    // internal no-arg usage).
    measureDroppableContainers([]);
  }, [currentPage, measureDroppableContainers]);

  const hasMultiplePages = pages.length > 1;
  const canGoPrev = currentPage > 0;
  const canGoNext = currentPage < pages.length - 1;

  // The bookmark currently being dragged (if any), rendered in a DragOverlay
  // portaled outside the grid. `bookmarksById` holds every bookmark in the
  // folder, so this resolves even once a drag has auto-advanced past the
  // dragged item's own page.
  const [activeBookmarkId, setActiveBookmarkId] = useState<string | null>(null);
  const activeBookmark = activeBookmarkId
    ? bookmarksById.get(activeBookmarkId)
    : undefined;

  // Returns whether a further advance in the same direction is still
  // possible, so useEdgePagination can keep paging across successive pages
  // while the icon is held at the edge (e.g. page 1 -> 2 -> 3 in one drag).
  const edgePagination = useEdgePagination((direction) => {
    if (direction === -1 && canGoPrev) {
      setCurrentPage(currentPage - 1);
      return currentPage - 1 > 0;
    }
    if (direction === 1 && canGoNext) {
      setCurrentPage(currentPage + 1);
      return currentPage + 1 < pages.length - 1;
    }
    return false;
  });

  useDndMonitor({
    onDragStart(event: DragStartEvent) {
      const activeData = event.active.data.current as
        { type?: string } | undefined;
      if (activeData?.type !== "bookmark") return;
      setActiveBookmarkId(String(event.active.id));
    },
    onDragMove(event: DragMoveEvent) {
      const activeData = event.active.data.current as
        { type?: string } | undefined;
      if (activeData?.type !== "bookmark") return;
      const draggedRect = event.active.rect.current.translated;
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!draggedRect || !containerRect) return;
      edgePagination.handleDragMove(draggedRect, containerRect);
    },
    onDragEnd(event: DragEndEvent) {
      const activeData = event.active.data.current as
        { type?: string } | undefined;
      if (activeData?.type !== "bookmark") return;
      edgePagination.reset();
      setActiveBookmarkId(null);
      const overData = event.over?.data.current as
        { type?: string } | undefined;
      if (!event.over || overData?.type !== "cell") return;
      // The cell id carries its own page, so a drop that landed on a page the
      // drag advanced to resolves against that destination page directly.
      const target = parseCellKey(String(event.over.id));
      if (!target) return;
      // Resolve against the full layout (all pages), not just one page: after
      // an edge auto-advance the dragged bookmark still lives on its origin
      // page while the drop cell is on the destination page.
      const updates = resolveDrop(
        String(event.active.id),
        target,
        pages.flat(),
      );
      void moveBookmarks(updates);
    },
    onDragCancel() {
      edgePagination.reset();
      setActiveBookmarkId(null);
    },
  });

  return (
    <>
      <div
        className="canvas"
        data-folder-id={folderId}
        ref={containerRef}
        style={backgroundStyle}
      >
        {loading ? (
          <p className="canvas-loading">Loading…</p>
        ) : (
          <>
            {/* Every page's grid is mounted; only the current one is shown.
                Keeping them all mounted means the dragged icon's node survives
                a drag-to-edge page flip (its source page is merely hidden, not
                unmounted), so dnd-kit doesn't drop the drag. */}
            {pages.map((pageEntries, pageIndex) => {
              const entryByCell = new Map(
                pageEntries.map((entry) => [
                  `${entry.cell.row}-${entry.cell.col}`,
                  entry,
                ]),
              );
              const isCurrent = pageIndex === currentPage;
              return (
                <div
                  key={pageIndex}
                  className="canvas-grid"
                  style={{
                    display: isCurrent ? "grid" : "none",
                    // Column tracks absorb whatever width doesn't divide evenly
                    // into whole cells, so the leftover reads as even margins
                    // between icons while every pixel stays inside a droppable
                    // cell — widening the *gaps* instead would carve dead
                    // strips down the canvas that swallow drops.
                    //
                    // minmax(0, …), not a bare 1fr: 1fr means minmax(auto, 1fr),
                    // whose auto floor refuses to shrink below the fixed-size
                    // icon within. The canvas is measured by ResizeObserver, so
                    // a sidebar drag renders one frame with the previous column
                    // count at the new width; a floorless track compresses for
                    // that frame instead of overflowing and clipping.
                    gridTemplateColumns: `repeat(${capacity.cols}, minmax(0, 1fr))`,
                    // Rows stay fixed-size: vertical leftover is intentionally
                    // left below the last row so the desktop stays top-anchored.
                    gridTemplateRows: `repeat(${capacity.rows}, ${iconSize}px)`,
                    gap: GRID_GAP,
                    padding: GRID_PADDING,
                  }}
                >
                  {Array.from({ length: capacity.rows }, (_, row) =>
                    Array.from({ length: capacity.cols }, (_, col) => {
                      const entry = entryByCell.get(`${row}-${col}`);
                      const bookmark = entry
                        ? bookmarksById.get(entry.bookmarkId)
                        : undefined;
                      return (
                        <GridCell
                          key={cellKey(pageIndex, row, col)}
                          cellKey={cellKey(pageIndex, row, col)}
                          size={iconSize}
                          occupied={Boolean(bookmark)}
                        >
                          {bookmark && (
                            <BookmarkIcon
                              bookmark={bookmark}
                              size={iconSize}
                              folderId={folderId}
                            />
                          )}
                        </GridCell>
                      );
                    }),
                  )}
                </div>
              );
            })}

            {hasMultiplePages && (
              <nav className="canvas-pagination" aria-label="Canvas pages">
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={!canGoPrev}
                  aria-label="Previous page"
                >
                  ‹
                </button>
                <span className="canvas-page-indicator">
                  Page {currentPage + 1} of {pages.length}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage(Math.min(pages.length - 1, currentPage + 1))
                  }
                  disabled={!canGoNext}
                  aria-label="Next page"
                >
                  ›
                </button>
              </nav>
            )}
          </>
        )}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeBookmark ? (
          <DraggedBookmarkOverlay bookmark={activeBookmark} size={iconSize} />
        ) : null}
      </DragOverlay>
    </>
  );
}
