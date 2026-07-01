import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragMoveEvent } from "@dnd-kit/core";
import { resolveDrop } from "../../lib/grid/dragDrop";
import { useGridLayout } from "../hooks/useGridLayout";
import { useEdgePagination } from "../hooks/useEdgePagination";
import { BookmarkIcon } from "./BookmarkIcon";
import { GridCell } from "./GridCell";

interface CanvasProps {
  folderId: string;
}

function cellKey(row: number, col: number): string {
  return `${row}-${col}`;
}

function parseCellKey(key: string): { row: number; col: number } | null {
  const match = /^(\d+)-(\d+)$/.exec(key);
  if (!match?.[1] || !match[2]) return null;
  return { row: Number(match[1]), col: Number(match[2]) };
}

export function Canvas({ folderId }: CanvasProps) {
  const {
    containerRef,
    capacity,
    pages,
    bookmarksById,
    iconSize,
    needsScroll,
    loading,
    currentPage,
    setCurrentPage,
    moveBookmarks,
  } = useGridLayout(folderId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const page = pages[currentPage] ?? [];
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

  function handleDragMove(event: DragMoveEvent) {
    const draggedRect = event.active.rect.current.translated;
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!draggedRect || !containerRect) return;
    edgePagination.handleDragMove(draggedRect, containerRect);
  }

  function handleDragEnd(event: DragEndEvent) {
    edgePagination.reset();
    const target = event.over ? parseCellKey(String(event.over.id)) : null;
    if (!target) return;
    const updates = resolveDrop(
      String(event.active.id),
      { page: currentPage, row: target.row, col: target.col },
      page,
    );
    void moveBookmarks(updates);
  }

  return (
    <div className="canvas" data-folder-id={folderId} ref={containerRef}>
      {loading ? (
        <p className="canvas-loading">Loading…</p>
      ) : (
        <>
          <DndContext
            sensors={sensors}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onDragCancel={() => edgePagination.reset()}
          >
            <div
              className={`canvas-grid${needsScroll ? " canvas-grid--scrollable" : ""}`}
              style={{
                gridTemplateColumns: `repeat(${capacity.cols}, ${iconSize}px)`,
                gridTemplateRows: `repeat(${capacity.rows}, ${iconSize}px)`,
              }}
            >
              {Array.from({ length: capacity.rows }, (_, row) =>
                Array.from({ length: capacity.cols }, (_, col) => {
                  const entry = page.find(
                    (e) => e.cell.row === row && e.cell.col === col,
                  );
                  const bookmark = entry
                    ? bookmarksById.get(entry.bookmarkId)
                    : undefined;
                  return (
                    <GridCell
                      key={cellKey(row, col)}
                      cellKey={cellKey(row, col)}
                      size={iconSize}
                    >
                      {bookmark && (
                        <BookmarkIcon bookmark={bookmark} size={iconSize} />
                      )}
                    </GridCell>
                  );
                }),
              )}
            </div>
          </DndContext>

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
