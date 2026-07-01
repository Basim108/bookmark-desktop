import type { GridCell } from "../grid/types";

/** Positions of a folder's direct bookmark children: bookmarkId -> cell. */
export type FolderPositions = Record<string, GridCell>;

/**
 * Full chrome.storage.local shape. Only `positions` is implemented in the
 * bookmark data layer (Group 2); the remaining keys are reserved so later
 * groups (grid/label/sidebar settings) share one documented schema instead
 * of ad-hoc keys.
 */
export interface StorageSchema {
  /** folderId -> (bookmarkId -> cell) */
  positions: Record<string, FolderPositions>;
  /** folderId -> grid layout settings (Group 4) */
  gridSettings?: Record<string, unknown>;
  /** bookmarkId -> label display + custom icon ref (Groups 7/8) */
  bookmarkSettings?: Record<string, unknown>;
  /** folderId -> sidebar display + custom icon ref (Groups 3/7) */
  folderSettings?: Record<string, unknown>;
}

export const STORAGE_KEYS = {
  POSITIONS: "positions",
  GRID_SETTINGS: "gridSettings",
  BOOKMARK_SETTINGS: "bookmarkSettings",
  FOLDER_SETTINGS: "folderSettings",
} as const satisfies Record<string, keyof StorageSchema>;
