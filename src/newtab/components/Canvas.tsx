import { useEffect } from "react";
import type { CSSProperties } from "react";
import { useDndMonitor } from "@dnd-kit/core";
import type { DragEndEvent, DragMoveEvent } from "@dnd-kit/core";
import { resolveDrop } from "../../lib/grid/dragDrop";
import { useGridLayout } from "../hooks/useGridLayout";
import { useEdgePagination } from "../hooks/useEdgePagination";
import { BookmarkIcon } from "./BookmarkIcon";
import { GridCell } from "./GridCell";

interface CanvasProps {
  folderId: string;
  /** Reports the canvas's current tier label font-size upward whenever it changes, so an ancestor can apply it as a shared CSS variable (see App). */
  onLabelFontSizeChange?: (labelFontSize: string) => void;
  /** Background-image style (image + size/position per fit) applied to the canvas area only. Empty when no background is set. */
  backgroundStyle?: CSSProperties;
}

function cellKey(row: number, col: number): string {
  return `${row}-${col}`;
}

function parseCellKey(key: string): { row: number; col: number } | null {
  const match = /^(\d+)-(\d+)$/.exec(key);
  if (!match?.[1] || !match[2]) return null;
  return { row: Number(match[1]), col: Number(match[2]) };
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

  const page = pages[currentPage] ?? [];
  const entryByCellKey = new Map(
    page.map((entry) => [cellKey(entry.cell.row, entry.cell.col), entry]),
  );
  const hasMultiplePages = pages.length > 1;
  const canGoPrev = currentPage > 0;
  const canGoNext = currentPage < pages.length - 1;

  const edgePagination = useEdgePagination((direction) => {
    if (direction === -1 && canGoPrev) {
      setCurrentPage(currentPage - 1);
    } else if (direction === 1 && canGoNext) {
      setCurrentPage(currentPage + 1);
    }
  });

  useDndMonitor({
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
      const overData = event.over?.data.current as
        { type?: string } | undefined;
      if (!event.over || overData?.type !== "cell") return;
      const target = parseCellKey(String(event.over.id));
      if (!target) return;
      const updates = resolveDrop(
        String(event.active.id),
        { page: currentPage, row: target.row, col: target.col },
        page,
      );
      void moveBookmarks(updates);
    },
    onDragCancel() {
      edgePagination.reset();
    },
  });

  return (
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
          <div
            className="canvas-grid"
            style={{
              gridTemplateColumns: `repeat(${capacity.cols}, ${iconSize}px)`,
              gridTemplateRows: `repeat(${capacity.rows}, ${iconSize}px)`,
            }}
          >
            {Array.from({ length: capacity.rows }, (_, row) =>
              Array.from({ length: capacity.cols }, (_, col) => {
                const entry = entryByCellKey.get(cellKey(row, col));
                const bookmark = entry
                  ? bookmarksById.get(entry.bookmarkId)
                  : undefined;
                return (
                  <GridCell
                    key={cellKey(row, col)}
                    cellKey={cellKey(row, col)}
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
  );
}
