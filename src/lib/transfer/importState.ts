import { createBookmark, createFolder } from "../bookmarks/create";
import { getFolderChildren, isFolder } from "../bookmarks/read";
import { validateBackgroundFile, validateIconFile } from "../icons/validation";
import { dataUrlToBlob } from "../import/dataUrl";
import {
  DEFAULT_BOOKMARK_SETTINGS,
  replaceAllBookmarkSettings,
} from "../storage/bookmarkSettings";
import {
  deleteCanvasBackground,
  putCanvasBackground,
} from "../storage/canvasBackground";
import { DEFAULT_FOLDER_ICON_KEY } from "../storage/defaultFolderIcon";
import { replaceAllFolderSettings } from "../storage/folderSettings";
import { setGeneralSettings } from "../storage/generalSettings";
import { deleteIcon, pruneIconsExcept, putIcon } from "../storage/iconDb";
import { replaceAllPositions } from "../storage/positions";
import type {
  BookmarkSettings,
  FolderPositions,
  FolderSettings,
  GeneralSettings,
} from "../storage/schema";
import { setSidebarWidth } from "../storage/sidebarSettings";
import { acquireTransferLock, releaseTransferLock } from "./lock";
import { PROTECTED_ROOT_IDS, ROOT_DISPLAY_NAMES } from "./roots";
import type { ProtectedRootId, SkippedEntryRecord, SkipReason } from "./types";
import { checkImportCompatibility } from "./version";

export type ImportDenial =
  "invalid-json" | "invalid-version" | "too-old" | "too-new";

export type ImportResult =
  | { ok: false; denied: ImportDenial }
  | { ok: false; aborted: true }
  | {
      ok: true;
      foldersCreated: number;
      bookmarksCreated: number;
      skipped: SkippedEntryRecord[];
    };

/** The user's answer to the pre-import confirmation. */
export type ImportChoice = "backup" | "no-backup" | "cancel";

/**
 * Optional UI callbacks, run only after the parse-and-version gate passes.
 * `confirmImport` presents the single Yes/No/Cancel confirmation: `"cancel"`
 * aborts before anything is touched, `"backup"` runs `performBackup` (export +
 * download) then imports, `"no-backup"` imports without a backup. Omitting
 * `confirmImport` proceeds without a backup (used by tests).
 */
export interface ImportHooks {
  confirmImport?: () => ImportChoice | Promise<ImportChoice>;
  performBackup?: () => Promise<void>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Attaches an inline base64 icon to a created node, mirroring the uTab
 * importer's swallow-and-fall-back behavior for a bad icon. Records the id in
 * the accumulator's keep-set so the post-import sweep does not prune the blob
 * it just wrote.
 */
async function attachIcon(
  acc: ImportAccumulator,
  itemId: string,
  icon: unknown,
): Promise<boolean> {
  if (typeof icon !== "string") return false;
  const blob = dataUrlToBlob(icon);
  if (!blob) return false;
  const result = await validateIconFile(blob);
  if (!result.ok) return false;
  await putIcon(itemId, blob);
  acc.iconIds.add(itemId);
  return true;
}

/**
 * Counts, skips, and the keep-set the post-import sweep prunes to.
 *
 * The per-item stores are accumulated here and written once at the end rather
 * than through the merging per-item setters, for two reasons: the sweep needs
 * the exact set of entries the import wrote (see the replace-strategy
 * requirement — the replaced tree's data must not survive), and a single
 * whole-map write avoids one read-modify-write per created item.
 */
interface ImportAccumulator {
  foldersCreated: number;
  bookmarksCreated: number;
  skipped: SkippedEntryRecord[];
  /** Ids that got a custom icon blob; the icon sweep keeps exactly these. */
  iconIds: Set<string>;
  positions: Record<string, FolderPositions>;
  bookmarkSettings: Record<string, BookmarkSettings>;
  folderSettings: Record<string, FolderSettings>;
}

function recordSkip(
  acc: ImportAccumulator,
  path: string[],
  name: string,
  url: string | null,
  reason: SkipReason,
): void {
  acc.skipped.push({
    absoluteFolderPath: path.join("/"),
    name,
    url,
    reason,
  });
}

/** Records a folder that failed to create, plus every descendant it would have held, as skipped. */
function recordSubtreeSkipped(
  acc: ImportAccumulator,
  node: unknown,
  path: string[],
  selfReason: SkipReason,
): void {
  const type = (node as { type?: unknown })?.type;
  const name = asString((node as { title?: unknown })?.title);
  if (type === "bookmark") {
    recordSkip(
      acc,
      path,
      name,
      asString((node as { url?: unknown }).url),
      selfReason,
    );
    return;
  }
  recordSkip(acc, path, name, null, selfReason);
  const childPath = [...path, name];
  for (const child of asArray((node as { children?: unknown })?.children)) {
    recordSubtreeSkipped(acc, child, childPath, "parent-skipped");
  }
}

/** Creates a container's children under `parentNewId`, restoring positions/settings/icons and accumulating skips. */
async function createChildren(
  children: unknown[],
  parentNewId: string,
  path: string[],
  acc: ImportAccumulator,
): Promise<void> {
  const positions: FolderPositions = {};

  for (const child of children) {
    const type = (child as { type?: unknown })?.type;
    const title = asString((child as { title?: unknown })?.title);

    if (type === "bookmark") {
      const url = asString((child as { url?: unknown }).url);
      const result = await createBookmark(parentNewId, title, url);
      if (!result.ok) {
        recordSkip(acc, path, title, url, result.error);
        continue;
      }
      acc.bookmarksCreated++;
      const newId = result.node.id;
      const hasCustomIcon = await attachIcon(
        acc,
        newId,
        (child as { icon?: unknown }).icon,
      );
      const tooltipOnly =
        (child as { settings?: { labelDisplay?: unknown } })?.settings
          ?.labelDisplay === "tooltip";
      // Only record non-default settings; readers fall back to the defaults, so
      // storing them would just bloat the map the sweep writes back.
      if (hasCustomIcon || tooltipOnly) {
        acc.bookmarkSettings[newId] = {
          ...DEFAULT_BOOKMARK_SETTINGS,
          ...(hasCustomIcon ? { hasCustomIcon: true } : {}),
          ...(tooltipOnly ? { labelDisplay: "tooltip" as const } : {}),
        };
      }
      const position = (child as { position?: unknown }).position;
      if (isGridCell(position)) {
        positions[newId] = position;
      }
      continue;
    }

    // Folder (default for anything not explicitly a bookmark).
    const result = await createFolder(parentNewId, title);
    if (!result.ok) {
      recordSubtreeSkipped(acc, child, path, result.error);
      continue;
    }
    acc.foldersCreated++;
    const newId = result.node.id;
    if (await attachIcon(acc, newId, (child as { icon?: unknown }).icon)) {
      acc.folderSettings[newId] = { hasCustomIcon: true };
    }
    await createChildren(
      asArray((child as { children?: unknown }).children),
      newId,
      [...path, title],
      acc,
    );
  }

  // Authoritative per-folder positions (no competing writer under the lock).
  // Accumulated rather than written here — the whole map is written once after
  // the root pass, so the replaced tree's positions cannot survive.
  if (Object.keys(positions).length > 0) {
    acc.positions[parentNewId] = positions;
  }
}

function isGridCell(
  value: unknown,
): value is { page: number; row: number; col: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { page?: unknown }).page === "number" &&
    typeof (value as { row?: unknown }).row === "number" &&
    typeof (value as { col?: unknown }).col === "number"
  );
}

/** Removes the given bookmark nodes (folders via removeTree, leaves via remove). */
async function deleteChildren(
  children: chrome.bookmarks.BookmarkTreeNode[],
): Promise<void> {
  for (const child of children) {
    if (isFolder(child)) {
      await chrome.bookmarks.removeTree(child.id);
    } else {
      await chrome.bookmarks.remove(child.id);
    }
  }
}

async function restoreGeneral(general: unknown): Promise<void> {
  const block = (general ?? {}) as Record<string, unknown>;

  if (typeof block.sidebarWidth === "number") {
    await setSidebarWidth(block.sidebarWidth);
  }
  if (
    typeof block.generalSettings === "object" &&
    block.generalSettings !== null
  ) {
    await setGeneralSettings(block.generalSettings as GeneralSettings);
  }

  await restoreGlobalIcon(
    block.canvasBackgroundIcon,
    validateBackgroundFile,
    putCanvasBackground,
    deleteCanvasBackground,
  );
  await restoreGlobalIcon(
    block.defaultFolderIcon,
    validateIconFile,
    (blob) => putIcon(DEFAULT_FOLDER_ICON_KEY, blob),
    () => deleteIcon(DEFAULT_FOLDER_ICON_KEY),
  );
}

/**
 * Restores one of the two global reserved-key images from the backup.
 *
 * Validated with the same magic-byte + decode + size check the per-item icon
 * path uses: the file is user-supplied and may be hand-edited, and this path
 * writes to storage with no id-based bound on size. Failure clears the target
 * rather than aborting the import, mirroring attachIcon's swallow-and-fall-back.
 */
async function restoreGlobalIcon(
  value: unknown,
  validate: (blob: Blob) => Promise<{ ok: boolean }>,
  put: (blob: Blob) => Promise<void>,
  clear: () => Promise<void>,
): Promise<void> {
  if (typeof value === "string") {
    const blob = dataUrlToBlob(value);
    if (blob && (await validate(blob)).ok) {
      await put(blob);
      return;
    }
  }
  // null / absent / undecodable / invalid → clear so the target matches the file.
  await clear();
}

/**
 * Imports a previously exported extension-state file with a replace strategy.
 * Validates only that the text is parseable JSON of a compatible major version
 * (no JSON-Schema validation); on a compatible file, optionally backs up, then
 * — under the transfer lock — deletes all non-root bookmarks and recreates the
 * tree, restoring positions/settings/icons and the general block. Entries that
 * fail Chrome's create guards are skipped and reported. The lock is always
 * released, even on error.
 */
export async function importState(
  text: string,
  hooks: ImportHooks = {},
): Promise<ImportResult> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, denied: "invalid-json" };
  }

  const compatibility = checkImportCompatibility(
    (data as { version?: unknown })?.version,
  );
  if (compatibility === "invalid")
    return { ok: false, denied: "invalid-version" };
  if (compatibility === "too-old") return { ok: false, denied: "too-old" };
  if (compatibility === "too-new") return { ok: false, denied: "too-new" };

  const choice: ImportChoice = hooks.confirmImport
    ? await hooks.confirmImport()
    : "no-backup";
  if (choice === "cancel") {
    return { ok: false, aborted: true };
  }
  if (choice === "backup") {
    await hooks.performBackup?.();
  }

  const acc: ImportAccumulator = {
    foldersCreated: 0,
    bookmarksCreated: 0,
    skipped: [],
    iconIds: new Set(),
    positions: {},
    bookmarkSettings: {},
    folderSettings: {},
  };

  await acquireTransferLock();
  try {
    const roots = ((data as { roots?: unknown }).roots ?? {}) as Record<
      string,
      unknown
    >;
    // Per-root create-before-delete: create the file's children FIRST, then
    // delete the old ones, so a root being restored into never goes empty. This
    // matters for the non-permanent Mobile root ("3"), which Chrome drops the
    // moment it is emptied — deleting first would leave nothing to restore into.
    for (const rootId of PROTECTED_ROOT_IDS) {
      const root = roots[rootId];
      const rootTitle = root
        ? asString((root as { title?: unknown }).title)
        : "";
      const path = [rootTitle || ROOT_DISPLAY_NAMES[rootId as ProtectedRootId]];
      const children = root
        ? asArray((root as { children?: unknown }).children)
        : [];

      // Snapshot the root's current children up front (to delete them last).
      let oldChildren: chrome.bookmarks.BookmarkTreeNode[];
      try {
        oldChildren = await getFolderChildren(rootId);
      } catch {
        // The root doesn't exist in this profile — nothing to delete, and we
        // cannot create into it. Report the file's content for it, if any.
        for (const child of children) {
          recordSubtreeSkipped(acc, child, path, "root-unavailable");
        }
        continue;
      }

      if (children.length > 0) {
        try {
          await createChildren(children, rootId, path, acc);
        } catch {
          // Couldn't create into this root after all; report its subtree and
          // leave the old content in place (don't half-empty a root we could
          // not restore).
          for (const child of children) {
            recordSubtreeSkipped(acc, child, path, "root-unavailable");
          }
          continue;
        }
      }

      // Delete the previously existing children last (root already repopulated).
      await deleteChildren(oldChildren);
    }

    // Replace the per-item stores with exactly what this import wrote. The
    // transfer lock suspends the onRemoved cleanup cascade that would normally
    // collect the deleted tree's entries, so without this the replaced tree's
    // positions, settings and icon blobs (up to 1 MB each) are orphaned with no
    // UI able to reach them again — growing with every restore.
    //
    // Deliberately inside the try and after the root pass, never in the finally:
    // if a root threw, the keep-set is incomplete and pruning against it would
    // delete data for items that are still live.
    await replaceAllPositions(acc.positions);
    await replaceAllBookmarkSettings(acc.bookmarkSettings);
    await replaceAllFolderSettings(acc.folderSettings);
    await pruneIconsExcept(acc.iconIds);

    await restoreGeneral((data as { general?: unknown }).general);
  } finally {
    await releaseTransferLock();
  }

  return {
    ok: true,
    foldersCreated: acc.foldersCreated,
    bookmarksCreated: acc.bookmarksCreated,
    skipped: acc.skipped,
  };
}
