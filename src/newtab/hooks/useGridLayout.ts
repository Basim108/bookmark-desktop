import { useEffect, useMemo, useRef, useState } from "react";
import { getBookmarksInFolder } from "../../lib/bookmarks/read";
import type { PositionUpdate } from "../../lib/grid/dragDrop";
import { paginate } from "../../lib/grid/layout";
import { backfillFolderPositions } from "../../lib/grid/seed";
import {
  reflowFolderPositions,
  shouldReflowOnGrowth,
} from "../../lib/grid/reflow";
import {
  computeAutoCapacity,
  computeAutoIconSize,
  computeFixedIconSize,
} from "../../lib/grid/sizing";
import type { GridCapacity } from "../../lib/grid/types";
import type { LayoutCell } from "../../lib/grid/layout";
import { resolveGridSettings } from "../../lib/storage/gridSettings";
import { setBookmarkPositions } from "../../lib/storage/positions";
import { GLOBAL_DEFAULT_GRID_SETTINGS } from "../../lib/storage/schema";
import type { FolderPositions, GridSettings } from "../../lib/storage/schema";
import { useElementSize } from "./useElementSize";

/** Fallback used only if a "fixed" override is ever saved without explicit dimensions. */
const FALLBACK_FIXED_CAPACITY: GridCapacity = { cols: 6, rows: 4 };

interface UseGridLayoutResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  capacity: GridCapacity;
  pages: LayoutCell[][];
  bookmarksById: Map<string, chrome.bookmarks.BookmarkTreeNode>;
  iconSize: number;
  needsScroll: boolean;
  loading: boolean;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  moveBookmarks: (updates: PositionUpdate[]) => Promise<void>;
}

interface FolderData {
  folderId: string;
  settings: GridSettings;
  bookmarks: chrome.bookmarks.BookmarkTreeNode[];
}

interface PageSelection {
  folderId: string;
  page: number;
}

function computeCapacityAndIconSize(
  settings: GridSettings,
  width: number,
  height: number,
): { capacity: GridCapacity; iconSize: number; needsScroll: boolean } {
  if (settings.mode === "fixed") {
    const capacity: GridCapacity = {
      cols: settings.fixedCols ?? FALLBACK_FIXED_CAPACITY.cols,
      rows: settings.fixedRows ?? FALLBACK_FIXED_CAPACITY.rows,
    };
    const { iconSize, needsScroll } = computeFixedIconSize(
      width,
      height,
      capacity,
      settings.minIconSize,
      settings.maxIconSize,
    );
    return { capacity, iconSize, needsScroll };
  }

  const capacity = computeAutoCapacity(width, height, settings.minIconSize);
  const iconSize = computeAutoIconSize(
    width,
    height,
    capacity,
    settings.maxIconSize,
  );
  return { capacity, iconSize, needsScroll: false };
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

  const settingsLoaded = folderData?.folderId === folderId;
  const settings = settingsLoaded
    ? folderData.settings
    : GLOBAL_DEFAULT_GRID_SETTINGS;

  // Load folder identity data (settings + direct bookmark children) fresh
  // whenever the selected folder changes. `settingsLoaded`/`currentPage`
  // above are derived by comparing folderId rather than reset here, so
  // the only setState call is the one inside `.then()`.
  useEffect(() => {
    let cancelled = false;
    previousCapacityRef.current = null;
    void Promise.all([
      resolveGridSettings(folderId),
      getBookmarksInFolder(folderId),
    ]).then(([resolvedSettings, bookmarks]) => {
      if (!cancelled) {
        setFolderData({ folderId, settings: resolvedSettings, bookmarks });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [folderId]);

  const { capacity, iconSize, needsScroll } = useMemo(
    () => computeCapacityAndIconSize(settings, size.width, size.height),
    [settings, size.width, size.height],
  );

  // Once real dimensions are measured, seed any missing positions using
  // the first-observed capacity as this session's baseline. Subsequent
  // *growth* triggers the mutating backfill repack. Shrink NEVER mutates
  // stored positions (see lib/grid/layout.ts's paginate) — it's handled
  // purely at render time below — so previousCapacityRef intentionally
  // stays pinned to the last-mutated baseline across a shrink, meaning a
  // later growth is still compared against pre-shrink capacity.
  useEffect(() => {
    if (!settingsLoaded || size.width === 0 || size.height === 0) {
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
  }, [folderId, settingsLoaded, capacity, size.width, size.height]);

  // paginate() is a pure display computation: it's re-run on every render
  // against the *current* capacity, so shrink-driven compaction/overflow
  // always reflects the latest size even though nothing was persisted.
  const pages = paginate(positions, capacity);
  const currentPage =
    pageSelection.folderId === folderId
      ? Math.min(pageSelection.page, Math.max(pages.length - 1, 0))
      : 0;
  const bookmarksById = new Map(
    (settingsLoaded ? folderData.bookmarks : []).map((bookmark) => [
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
    needsScroll,
    loading: !settingsLoaded,
    currentPage,
    setCurrentPage: (page: number) => setPageSelection({ folderId, page }),
    moveBookmarks,
  };
}
