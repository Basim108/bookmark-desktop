import { useEffect, useMemo, useRef, useState } from "react";
import { useDndMonitor } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { getBookmarksInFolder } from "../../lib/bookmarks/read";
import { subscribeToBookmarkChanges } from "../../lib/bookmarks/events";
import type { PositionUpdate } from "../../lib/grid/dragDrop";
import { paginate } from "../../lib/grid/layout";
import { backfillFolderPositions } from "../../lib/grid/seed";
import {
  reflowFolderPositions,
  shouldReflowOnGrowth,
} from "../../lib/grid/reflow";
import {
  GRID_GAP,
  GRID_PADDING,
  computeGridCapacity,
  resolveTier,
} from "../../lib/grid/sizing";
import type { GridCapacity } from "../../lib/grid/types";
import type { LayoutCell } from "../../lib/grid/layout";
import { onStorageKeysChanged } from "../../lib/storage/onChanged";
import { setBookmarkPositions } from "../../lib/storage/positions";
import { STORAGE_KEYS } from "../../lib/storage/schema";
import type { FolderPositions } from "../../lib/storage/schema";
import { useElementSize } from "./useElementSize";

interface UseGridLayoutResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  capacity: GridCapacity;
  pages: LayoutCell[][];
  bookmarksById: Map<string, chrome.bookmarks.BookmarkTreeNode>;
  iconSize: number;
  labelFontSize: string;
  loading: boolean;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  moveBookmarks: (updates: PositionUpdate[]) => Promise<void>;
}

interface FolderData {
  folderId: string;
  bookmarks: chrome.bookmarks.BookmarkTreeNode[];
}

interface PageSelection {
  folderId: string;
  page: number;
}

/**
 * Icon size and label font-size are a fixed tier lookup on the canvas's raw
 * available width — deliberately not the padding-reduced width, so the
 * 512/1024 tier breakpoints keep meaning what the spec says they mean.
 * Capacity is then derived from that icon size plus the gap and padding the
 * grid actually spends, so no cell is ever rendered outside the canvas.
 */
function computeCapacityAndTier(
  width: number,
  height: number,
): { capacity: GridCapacity; iconSize: number; labelFontSize: string } {
  const { iconSize, labelFontSize } = resolveTier(width);
  const capacity = computeGridCapacity(
    width,
    height,
    iconSize,
    GRID_GAP,
    GRID_PADDING,
  );
  return { capacity, iconSize, labelFontSize };
}

export function useGridLayout(folderId: string): UseGridLayoutResult {
  const { ref: containerRef, size } = useElementSize<HTMLDivElement>();
  const [folderData, setFolderData] = useState<FolderData | null>(null);
  const [positions, setPositions] = useState<FolderPositions>({});
  const [pageSelection, setPageSelection] = useState<PageSelection>({
    folderId,
    page: 0,
  });
  const previousCapacityRef = useRef<GridCapacity | null>(null);

  const dataLoaded = folderData?.folderId === folderId;

  // Load this folder's direct bookmark children fresh whenever the selected
  // folder changes. `dataLoaded`/`currentPage` above are derived by
  // comparing folderId rather than reset here, so the only setState call is
  // the one inside `.then()`.
  useEffect(() => {
    let cancelled = false;
    previousCapacityRef.current = null;
    void getBookmarksInFolder(folderId)
      .then((bookmarks) => {
        if (!cancelled) {
          setFolderData({ folderId, bookmarks });
        }
      })
      // The folder can vanish out from under us (e.g. a state-transfer import
      // replaces the whole tree, or a native-manager deletion of the folder
      // we're viewing), leaving a stale id whose read rejects. Swallow it — a
      // resync/reload settles the view — rather than surface an uncaught error.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [folderId]);

  // Live sync: refetch this folder's direct bookmark children on any
  // bookmark/folder structure change, whether from this extension's own UI
  // or Chrome's native bookmark manager, this tab or another open one.
  // Deliberately doesn't reset previousCapacityRef — position bookkeeping
  // (backfill/reflow/cleanup) is already handled by the background
  // listener and arrives here separately via the storage.onChanged
  // subscription below; this only refreshes bookmark identity data
  // (title/url) for rendering.
  useEffect(
    () =>
      subscribeToBookmarkChanges(() => {
        void getBookmarksInFolder(folderId)
          .then((bookmarks) => {
            setFolderData((current) =>
              current && current.folderId === folderId
                ? { ...current, bookmarks }
                : current,
            );
          })
          // Selected folder may have just been deleted (see the load effect
          // above); a stale-id read must not surface as an uncaught rejection.
          .catch(() => {});
      }),
    [folderId],
  );

  const { capacity, iconSize, labelFontSize } = useMemo(
    () => computeCapacityAndTier(size.width, size.height),
    [size.width, size.height],
  );

  // Once real dimensions are measured, seed any missing positions using
  // the first-observed capacity as this session's baseline. Subsequent
  // *growth* triggers the mutating backfill repack. Shrink NEVER mutates
  // stored positions (see lib/grid/layout.ts's paginate) — it's handled
  // purely at render time below — so previousCapacityRef intentionally
  // stays pinned to the last-mutated baseline across a shrink, meaning a
  // later growth is still compared against pre-shrink capacity.
  useEffect(() => {
    if (!dataLoaded || size.width === 0 || size.height === 0) {
      return;
    }
    let cancelled = false;
    const previous = previousCapacityRef.current;
    if (!previous) {
      void backfillFolderPositions(folderId, capacity).then((result) => {
        if (!cancelled) {
          setPositions(result);
          previousCapacityRef.current = capacity;
        }
      });
    } else if (shouldReflowOnGrowth(previous, capacity)) {
      void reflowFolderPositions(folderId, capacity).then((result) => {
        if (!cancelled) {
          setPositions(result);
          previousCapacityRef.current = capacity;
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [folderId, dataLoaded, capacity, size.width, size.height]);

  // Cross-tab live sync: another open new-tab page's position writes arrive
  // here via chrome.storage.onChanged. The writing tab already resolved
  // backfill/reflow before persisting, so this is a direct apply.
  useEffect(
    () =>
      onStorageKeysChanged([STORAGE_KEYS.POSITIONS], (changes) => {
        const positionsChange = changes[STORAGE_KEYS.POSITIONS];
        if (positionsChange) {
          const newValue = positionsChange.newValue as
            Record<string, FolderPositions> | undefined;
          const folderPositions = newValue?.[folderId];
          if (folderPositions) {
            setPositions(folderPositions);
          }
        }
      }),
    [folderId],
  );

  // Dragging one of this folder's bookmarks onto a sidebar folder row moves
  // it via the bookmarks API (see App's shared DndContext); optimistically
  // drop it from this view immediately rather than waiting for a reload —
  // full cross-tab structure sync is wired in Group 9.
  useDndMonitor({
    onDragEnd(event: DragEndEvent) {
      const activeData = event.active.data.current as
        { type?: string; sourceFolderId?: string } | undefined;
      if (
        activeData?.type !== "bookmark" ||
        activeData.sourceFolderId !== folderId
      ) {
        return;
      }
      const overData = event.over?.data.current as
        { type?: string; folderId?: string } | undefined;
      if (overData?.type !== "folder" || overData.folderId === folderId) {
        return;
      }
      const bookmarkId = String(event.active.id);
      setFolderData((current) =>
        current && current.folderId === folderId
          ? {
              ...current,
              bookmarks: current.bookmarks.filter((b) => b.id !== bookmarkId),
            }
          : current,
      );
      setPositions((current) => {
        if (!(bookmarkId in current)) return current;
        const { [bookmarkId]: _removed, ...rest } = current;
        return rest;
      });
    },
  });

  // paginate() is a pure display computation: it's re-run on every render
  // against the *current* capacity, so shrink-driven compaction/overflow
  // always reflects the latest size even though nothing was persisted.
  const pages = paginate(positions, capacity);
  const currentPage =
    pageSelection.folderId === folderId
      ? Math.min(pageSelection.page, Math.max(pages.length - 1, 0))
      : 0;
  const bookmarksById = new Map(
    (dataLoaded ? folderData.bookmarks : []).map((bookmark) => [
      bookmark.id,
      bookmark,
    ]),
  );

  async function moveBookmarks(updates: PositionUpdate[]): Promise<void> {
    if (updates.length === 0) {
      return;
    }
    await setBookmarkPositions(folderId, updates);
    setPositions((current) => {
      const next = { ...current };
      for (const update of updates) {
        next[update.bookmarkId] = update.cell;
      }
      return next;
    });
  }

  return {
    containerRef,
    capacity,
    pages,
    bookmarksById,
    iconSize,
    labelFontSize,
    loading: !dataLoaded,
    currentPage,
    setCurrentPage: (page: number) => setPageSelection({ folderId, page }),
    moveBookmarks,
  };
}
