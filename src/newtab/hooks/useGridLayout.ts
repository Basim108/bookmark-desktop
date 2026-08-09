import { useEffect, useMemo, useRef, useState } from "react";
import { useDndMonitor } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { getBookmarksInFolder } from "../../lib/bookmarks/read";
import { subscribeToBookmarkChanges } from "../../lib/bookmarks/events";
import type { PositionUpdate } from "../../lib/grid/dragDrop";
import { paginate } from "../../lib/grid/layout";
import { cellToSlot } from "../../lib/grid/placement";
import { backfillFolderPositions } from "../../lib/grid/seed";
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
  // Which folder has already had its missing positions seeded this session.
  // Seeding is a first-run/backfill concern only — nothing about the window
  // size participates, because a slot carries no capacity.
  const backfilledFolderRef = useRef<string | null>(null);

  const dataLoaded = folderData?.folderId === folderId;

  // Load this folder's direct bookmark children fresh whenever the selected
  // folder changes. `dataLoaded`/`currentPage` above are derived by
  // comparing folderId rather than reset here, so the only setState call is
  // the one inside `.then()`.
  useEffect(() => {
    let cancelled = false;
    backfilledFolderRef.current = null;
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
  // Deliberately doesn't reset backfilledFolderRef — position bookkeeping
  // (backfill/cleanup) is already handled by the background listener and
  // arrives here separately via the storage.onChanged subscription below;
  // this only refreshes bookmark identity data (title/url) for rendering.
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

  // Seed a position for any bookmark that lacks one, once per folder.
  //
  // Deliberately not keyed on `capacity`: a slot is capacity-free, so there is
  // nothing for a resize to recompute and no reason to wait for a measurement.
  // This is the *only* position write this hook performs outside a user action,
  // and it never touches a bookmark that already has a slot — which is what
  // makes "a window resize never writes stored positions" hold literally.
  useEffect(() => {
    if (!dataLoaded || backfilledFolderRef.current === folderId) {
      return;
    }
    let cancelled = false;
    backfilledFolderRef.current = folderId;
    void backfillFolderPositions(folderId).then((result) => {
      if (!cancelled) {
        setPositions(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [folderId, dataLoaded]);

  // Cross-tab live sync: another open new-tab page's position writes arrive
  // here via chrome.storage.onChanged. The writing tab already resolved
  // backfill before persisting, so this is a direct apply.
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

  // paginate() is a pure display computation: it re-runs on every render
  // against the *current* capacity, so the layout always reflects the latest
  // size even though a resize persists nothing. Returning to a size the folder
  // was viewed at redisplays it identically, by arithmetic.
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

  /**
   * The storage boundary, and the only place the current capacity is consulted
   * for a write: a drag resolves against the cells the user can see, and the
   * cell they dropped on is converted once, here, into the slot that is stored.
   */
  async function moveBookmarks(updates: PositionUpdate[]): Promise<void> {
    if (updates.length === 0) {
      return;
    }
    const slotUpdates = updates.map((update) => ({
      bookmarkId: update.bookmarkId,
      slot: cellToSlot(update.cell, capacity),
    }));
    await setBookmarkPositions(folderId, slotUpdates);
    setPositions((current) => {
      const next = { ...current };
      for (const update of slotUpdates) {
        next[update.bookmarkId] = update.slot;
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
