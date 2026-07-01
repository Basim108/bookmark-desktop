import type { GridCell } from "../grid/types";

/** Positions of a folder's direct bookmark children: bookmarkId -> cell. */
export type FolderPositions = Record<string, GridCell>;

export type FolderSidebarDisplay =
  "icon-only" | "label-only" | "icon-and-label";

/** A folder's own sidebar row settings. Independent per folder — no inheritance chain (unlike grid settings). */
export interface FolderSettings {
  sidebarDisplay: FolderSidebarDisplay;
  /** Metadata mirror of whether an IndexedDB icon record exists (Group 7), so UI can gate icon options without an async IndexedDB read. */
  hasCustomIcon: boolean;
}

export type GridMode = "auto" | "fixed";

/** A folder's own grid layout override. Any subset of fields may be set; unset fields fall through the inheritance chain individually is NOT supported — a folder's override is all-or-nothing per the "nearest ancestor" resolution model. */
export interface GridSettings {
  mode: GridMode;
  /** Icon px size cap in both modes. */
  maxIconSize: number;
  /** Icon px size floor: drives auto-mode's column/row count formula, and triggers fixed-mode scrolling instead of shrinking further. */
  minIconSize: number;
  /** Only meaningful when mode is "fixed". */
  fixedCols?: number;
  fixedRows?: number;
}

export const GLOBAL_DEFAULT_GRID_SETTINGS: GridSettings = {
  mode: "auto",
  maxIconSize: 96,
  minIconSize: 48,
};

export type BookmarkLabelDisplay = "under-icon" | "tooltip";

/** A bookmark's own display settings. Independent per bookmark — no inheritance (same shape of rule as FolderSettings). */
export interface BookmarkSettings {
  labelDisplay: BookmarkLabelDisplay;
  /** Metadata mirror of whether an IndexedDB icon record exists (Group 7), so UI can render/gate without an async IndexedDB read. */
  hasCustomIcon: boolean;
}

/**
 * Full chrome.storage.local shape. Only `positions`, `folderSettings`, and
 * `gridSettings` are implemented so far; the remaining key is reserved so
 * later groups (label settings) share one documented schema instead of
 * ad-hoc keys.
 */
export interface StorageSchema {
  /** folderId -> (bookmarkId -> cell) */
  positions: Record<string, FolderPositions>;
  /** folderId -> grid layout override (sparse; absence means "inherit") */
  gridSettings: Record<string, GridSettings>;
  /** The global fallback grid settings, used when no folder in the ancestor chain has an override. */
  globalGridSettings: GridSettings;
  /** bookmarkId -> label display + custom-icon metadata mirror */
  bookmarkSettings: Record<string, BookmarkSettings>;
  /** folderId -> sidebar display settings */
  folderSettings: Record<string, FolderSettings>;
}

export const STORAGE_KEYS = {
  POSITIONS: "positions",
  GRID_SETTINGS: "gridSettings",
  GLOBAL_GRID_SETTINGS: "globalGridSettings",
  BOOKMARK_SETTINGS: "bookmarkSettings",
  FOLDER_SETTINGS: "folderSettings",
} as const satisfies Record<string, keyof StorageSchema>;
