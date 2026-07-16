import type { GridCell } from "../grid/types";

/** Positions of a folder's direct bookmark children: bookmarkId -> cell. */
export type FolderPositions = Record<string, GridCell>;

/** A folder's own sidebar row settings. Independent per folder — no inheritance chain (unlike grid settings). */
export interface FolderSettings {
  /**
   * Metadata mirror of whether an IndexedDB icon record exists (Group 7), so
   * the sidebar row can pick the custom-icon key vs. the shared default-icon
   * key without an async IndexedDB read. Folder rows always render an icon +
   * name; this only selects which icon.
   */
  hasCustomIcon: boolean;
}

/** How a canvas background image is fitted to the canvas area. */
export type BackgroundFit = "cover" | "contain" | "center";

/**
 * The canvas background. `none` means no background image. `upload` means an
 * image is stored in IndexedDB under the reserved canvas-background key (see
 * canvasBackground.ts); only its fit mode is kept here so the canvas can decide
 * how to render without an async IndexedDB read blocking layout.
 */
export type CanvasBackground =
  { kind: "none" } | { kind: "upload"; fit: BackgroundFit };

/**
 * Global, page-wide settings (not tied to any one folder or bookmark). Held as
 * a single object so future global settings are added as fields rather than new
 * top-level storage keys.
 */
export interface GeneralSettings {
  background: CanvasBackground;
}

export type BookmarkLabelDisplay = "under-icon" | "tooltip";

/** A bookmark's own display settings. Independent per bookmark — no inheritance (same shape of rule as FolderSettings). */
export interface BookmarkSettings {
  labelDisplay: BookmarkLabelDisplay;
  /** Metadata mirror of whether an IndexedDB icon record exists (Group 7), so UI can render/gate without an async IndexedDB read. */
  hasCustomIcon: boolean;
}

/**
 * Full chrome.storage.local shape. Only `positions` and `folderSettings`
 * are implemented so far; the remaining key is reserved so later groups
 * (label settings) share one documented schema instead of ad-hoc keys.
 */
export interface StorageSchema {
  /** folderId -> (bookmarkId -> cell) */
  positions: Record<string, FolderPositions>;
  /** bookmarkId -> label display + custom-icon metadata mirror */
  bookmarkSettings: Record<string, BookmarkSettings>;
  /** folderId -> sidebar display settings */
  folderSettings: Record<string, FolderSettings>;
  /** User-resized sidebar width in px. */
  sidebarWidth: number;
  /** Global, page-wide settings (e.g. the canvas background). */
  generalSettings: GeneralSettings;
}

export const STORAGE_KEYS = {
  POSITIONS: "positions",
  BOOKMARK_SETTINGS: "bookmarkSettings",
  FOLDER_SETTINGS: "folderSettings",
  SIDEBAR_WIDTH: "sidebarWidth",
  GENERAL_SETTINGS: "generalSettings",
} as const satisfies Record<string, keyof StorageSchema>;
