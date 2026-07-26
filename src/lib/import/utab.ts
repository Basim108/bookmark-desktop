import { createBookmark, createFolder } from "../bookmarks/create";
import type { BookmarkCreateError } from "../bookmarks/create";
import { validateIconFile } from "../icons/validation";
import { setBookmarkHasCustomIcon } from "../storage/bookmarkSettings";
import { setFolderHasCustomIcon } from "../storage/folderSettings";
import { putIcon } from "../storage/iconDb";
import type { SkipReason } from "../transfer/types";
import { dataUrlToBlob } from "./dataUrl";
import type { ImportReportRow } from "./report";

/**
 * The subset of a uTab export this importer reads. Everything is typed as
 * `unknown` because the input is an untrusted file: each field is checked
 * before use rather than trusting the export's shape. uTab also emits `id` and
 * a remote `icon` URL per bookmark; those are ignored (only the embedded
 * base64 `preview` is used, avoiding any network fetch). `_id` is never used
 * for creation either — it is read solely so the import report can point a
 * skipped row back at its entry in the user's source file.
 */
interface UtabBookmark {
  _id?: unknown;
  title?: unknown;
  url?: unknown;
  preview?: unknown;
}

interface UtabFolder {
  _id?: unknown;
  name?: unknown;
  preview?: unknown;
  bookmarks?: unknown;
}

export interface UtabImportSummary {
  foldersCreated: number;
  bookmarksCreated: number;
  /** Entries (folders or bookmarks) skipped for a blank name/title or unsafe url. */
  skipped: number;
}

export type UtabImportError = "invalid-json" | "not-utab";

export type UtabImportResult =
  | { ok: true; summary: UtabImportSummary; rows: ImportReportRow[] }
  | { ok: false; error: UtabImportError };

/**
 * Parses raw file text as a uTab export. Returns the `folders` array on
 * success, or a structural error: `invalid-json` when the text is not JSON,
 * `not-utab` when it is JSON but lacks a `folders` array. This is the
 * whole-file gate — a structural failure means nothing is created.
 */
export function parseUtabExport(
  text: string,
): { ok: true; folders: UtabFolder[] } | { ok: false; error: UtabImportError } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid-json" };
  }
  if (
    typeof data !== "object" ||
    data === null ||
    !Array.isArray((data as { folders?: unknown }).folders)
  ) {
    return { ok: false, error: "not-utab" };
  }
  return { ok: true, folders: (data as { folders: UtabFolder[] }).folders };
}

/**
 * Decodes an item's `preview` data URL, validates it with the same pipeline as
 * a user upload (format sniff + decode + size cap), and stores it as the
 * created node's custom icon.
 *
 * Returns whether the icon was attached. A failure never blocks the import —
 * the folder/bookmark still exists and falls back to its default icon — but,
 * unlike before, a `preview` that was *present* and unusable is reported as a
 * warning rather than silently discarded. An absent preview is not a failure:
 * the user simply had no icon for that entry.
 */
async function attachPreviewIcon(
  itemId: string,
  preview: unknown,
  setHasCustomIcon: (id: string, value: boolean) => Promise<void>,
): Promise<boolean> {
  if (typeof preview !== "string" || preview.length === 0) return true;
  const blob = dataUrlToBlob(preview);
  if (!blob) return false;
  const result = await validateIconFile(blob);
  if (!result.ok) return false;
  await putIcon(itemId, blob);
  await setHasCustomIcon(itemId, true);
  return true;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * The uTab `_id` of an entry, when it has a usable one. Untrusted like every
 * other field, and omitted rather than blanked so a row without one simply has
 * no id cell.
 */
function asId(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Maps a creation guard's rejection onto the shared report vocabulary. */
function reasonForCreateError(error: BookmarkCreateError): SkipReason {
  return error === "empty-title" ? "empty-title" : "unsafe-url";
}

/**
 * Imports a uTab export into `targetFolderId`. Each export folder becomes a
 * Chrome subfolder of the target; its bookmarks become Chrome bookmarks inside
 * that subfolder. Icons come from each entry's base64 `preview`. Structurally
 * invalid input creates nothing; individual entries with a blank name/title or
 * unsafe url are skipped and counted, and a folder that itself can't be created
 * takes its bookmarks with it into the skipped count. Grid placement is left to
 * the background onCreated listener, so this never writes positions itself.
 */
export async function importUtabExport(
  targetFolderId: string,
  text: string,
): Promise<UtabImportResult> {
  const parsed = parseUtabExport(text);
  if (!parsed.ok) {
    return parsed;
  }

  let foldersCreated = 0;
  let bookmarksCreated = 0;
  let skipped = 0;
  // Accumulated as the import runs, not assembled from the result at the end:
  // a thrown create/putIcon must still leave a report of what happened up to
  // that point, and a report built only on the success path would produce
  // nothing in exactly the case that most needs one.
  const rows: ImportReportRow[] = [];

  try {
    for (const folder of parsed.folders) {
      const bookmarks = (
        Array.isArray(folder?.bookmarks) ? folder.bookmarks : []
      ) as UtabBookmark[];
      const folderName = asString(folder?.name);

      const folderResult = await createFolder(targetFolderId, folderName);
      if (!folderResult.ok) {
        // Can't create the folder → its bookmarks have nowhere to go; count the
        // folder and every bookmark it would have held as skipped.
        skipped += 1 + bookmarks.length;
        rows.push({
          status: "skipped",
          id: asId(folder?._id),
          title: folderName,
          reason: reasonForCreateError(folderResult.error),
        });
        for (const bookmark of bookmarks) {
          // `folder` is deliberately absent: the name was blank, which is
          // precisely why it failed, so there is nothing truthful to print.
          rows.push({
            status: "skipped",
            id: asId(bookmark?._id),
            title: asString(bookmark?.title),
            url: asString(bookmark?.url),
            reason: "parent-skipped",
          });
        }
        continue;
      }
      foldersCreated++;
      const folderIconOk = await attachPreviewIcon(
        folderResult.node.id,
        folder?.preview,
        setFolderHasCustomIcon,
      );
      if (!folderIconOk) {
        rows.push({
          status: "warning",
          id: asId(folder?._id),
          folder: folderName,
          title: folderName,
          reason: "icon-failed",
        });
      }

      for (const bookmark of bookmarks) {
        const title = asString(bookmark?.title);
        const url = asString(bookmark?.url);
        const bookmarkResult = await createBookmark(
          folderResult.node.id,
          title,
          url,
        );
        if (!bookmarkResult.ok) {
          skipped++;
          rows.push({
            status: "skipped",
            id: asId(bookmark?._id),
            folder: folderName,
            title,
            url,
            reason: reasonForCreateError(bookmarkResult.error),
          });
          continue;
        }
        bookmarksCreated++;
        const iconOk = await attachPreviewIcon(
          bookmarkResult.node.id,
          bookmark?.preview,
          setBookmarkHasCustomIcon,
        );
        if (!iconOk) {
          rows.push({
            status: "warning",
            id: asId(bookmark?._id),
            folder: folderName,
            title,
            url,
            reason: "icon-failed",
          });
        }
      }
    }
  } catch (error) {
    // chrome.bookmarks.create and putIcon both reject on quota. Previously
    // nothing caught them, so the rejection escaped the importer entirely and
    // left the calling dialog pending forever. Record it and end the import
    // with whatever was already created.
    rows.push({
      status: "fatal",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    ok: true,
    summary: { foldersCreated, bookmarksCreated, skipped },
    rows,
  };
}
