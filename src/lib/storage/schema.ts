import type { GridCapacity, GridCell, Slot } from "../grid/types";

/**
 * Positions of a folder's direct bookmark children: bookmarkId -> slot.
 *
 * A slot carries no capacity, so nothing about the current window is baked into
 * what is stored — which is what makes a resize a pure display reflow and a size
 * round trip the identity. The displayed cell is derived per render by
 * grid/layout.ts's paginate.
 */
export type FolderPositions = Record<string, Slot>;

/**
 * Shape of the positions store. Version 1 held `(page, row, col)` cells framed
 * on an unrecorded capacity; version 2 holds capacity-free slots. Recorded so
 * the one-time conversion (storage/positionsMigration.ts) runs exactly once per
 * profile, and so a second context observes the finished conversion rather than
 * repeating it against a different frame.
 */
export const POSITIONS_SCHEMA_SLOTS = 2;

/** Positions of a folder's direct bookmark children as stored before slots. */
export type LegacyFolderPositions = Record<string, GridCell>;

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
  /** folderId -> (bookmarkId -> slot) */
  positions: Record<string, FolderPositions>;
  /**
   * Which shape `positions` is stored in. Absent means the pre-slot cell shape,
   * which is converted once on first read — see storage/positionsMigration.ts.
   */
  positionsSchema: number;
  /** bookmarkId -> label display + custom-icon metadata mirror */
  bookmarkSettings: Record<string, BookmarkSettings>;
  /** folderId -> sidebar display settings */
  folderSettings: Record<string, FolderSettings>;
  /** User-resized sidebar width in px. */
  sidebarWidth: number;
  /** Global, page-wide settings (e.g. the canvas background). */
  generalSettings: GeneralSettings;
  /**
   * The folder the user most recently selected in the sidebar, restored as the
   * active folder when a new-tab page loads. Session state describing where the
   * user was last working — not a setting they configured — so it is
   * deliberately kept out of `generalSettings` and excluded from state
   * export/import (see lastFolder.ts). Held as its own top-level key so writing
   * it never read-modify-writes a record another writer shares.
   */
  lastFolderId: string;
  /**
   * Legacy: the grid capacity most recently measured by a new-tab page, written
   * only by versions that stored positions as cells. Nothing writes it now —
   * placement is capacity-free — and its sole remaining reader is the one-time
   * conversion of those cells into slots, which needs the frame they were
   * authored in. See storage/gridCapacity.ts.
   *
   * Device-derived measurement, not a setting the user configured, so like
   * lastFolderId it is excluded from state export/import.
   */
  gridCapacity: GridCapacity;
}

export const STORAGE_KEYS = {
  POSITIONS: "positions",
  POSITIONS_SCHEMA: "positionsSchema",
  BOOKMARK_SETTINGS: "bookmarkSettings",
  FOLDER_SETTINGS: "folderSettings",
  SIDEBAR_WIDTH: "sidebarWidth",
  GENERAL_SETTINGS: "generalSettings",
  LAST_FOLDER_ID: "lastFolderId",
  GRID_CAPACITY: "gridCapacity",
} as const satisfies Record<string, keyof StorageSchema>;
