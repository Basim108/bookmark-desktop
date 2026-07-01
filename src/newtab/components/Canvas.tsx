import { useGridLayout } from "../hooks/useGridLayout";
import { BookmarkIcon } from "./BookmarkIcon";

interface CanvasProps {
  folderId: string;
}

export function Canvas({ folderId }: CanvasProps) {
  const {
    containerRef,
    pages,
    bookmarksById,
    iconSize,
    needsScroll,
    loading,
    currentPage,
    setCurrentPage,
  } = useGridLayout(folderId);

  const page = pages[currentPage] ?? [];
  const hasMultiplePages = pages.length > 1;

  return (
    <div className="canvas" data-folder-id={folderId} ref={containerRef}>
      {loading ? (
        <p className="canvas-loading">Loading…</p>
      ) : (
        <>
          <div
            className={`canvas-grid${needsScroll ? " canvas-grid--scrollable" : ""}`}
          >
            {page.map((entry) => {
              const bookmark = bookmarksById.get(entry.bookmarkId);
              if (!bookmark) return null;
              return (
                <BookmarkIcon
                  key={entry.bookmarkId}
                  bookmark={bookmark}
                  size={iconSize}
                />
              );
            })}
          </div>

          {hasMultiplePages && (
            <nav className="canvas-pagination" aria-label="Canvas pages">
              <button
                type="button"
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
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
                disabled={currentPage === pages.length - 1}
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
