import { createBookmark, createFolder } from "../bookmarks/create";
import type { BookmarkCreateError } from "../bookmarks/create";
import { validateIconFile } from "../icons/validation";
import {
  setBookmarkHasCustomIcon,
  setBookmarkLabelDisplay,
} from "../storage/bookmarkSettings";
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
  /**
   * Entries that looked like real bookmarks but could not be imported — in
   * practice an unusable url, since a blank folder name is defaulted and a
   * blank bookmark title falls back to its url. Excludes empty grid slots,
   * which are not entries at all.
   */
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

/**
 * Whether an element of a folder's `bookmarks` array is an empty grid slot
 * rather than a bookmark that failed to import.
 *
 * uTab exports each folder's bookmarks as a fixed-size array — one element per
 * grid position — with placeholder elements for the positions the user never
 * filled. Most of a real export's elements are therefore not bookmarks at all.
 * In the measured export (`design/examples/uTab_settings_26-07-2026-report.log`)
 * 758 of 783 reported "skips" were url-less placeholders, so the summary said
 * "skipped 783" when 25 bookmarks had actually been lost, and the 25 rows worth
 * reading were buried under 758 saying an empty slot was empty. A slot is not
 * an error and there is nothing the user can do about one, so it is not
 * created, not counted, and not reported.
 *
 * The missing url is deliberately sufficient on its own — `title` and `_id` are
 * not consulted. Against real data all three predicates select the same
 * elements, and an entry with no url could not be created under any reading of
 * it. Accepted trade-off: an entry carrying a title but no url is dropped
 * silently rather than reported.
 */
function isEmptySlot(bookmark: UtabBookmark | undefined): boolean {
  return asString(bookmark?.url).trim().length === 0;
}

/**
 * Name given to an export folder that has none. uTab allows an unnamed folder;
 * Chrome and this app's own guards do not, and dropping the folder would drop
 * its entire subtree of otherwise valid bookmarks with it.
 *
 * Deliberately the same string the create-folder draft window uses as its
 * heading, so a folder that arrives unnamed by import reads the same as one the
 * user would have created by hand.
 */
const DEFAULT_FOLDER_NAME = "New Folder";

/**
 * Maps a creation guard's rejection onto the shared report vocabulary.
 *
 * Kept total rather than collapsed to a constant even though `empty-title` is
 * now unreachable from this importer — a blank folder name is defaulted and a
 * blank bookmark title falls back to its url, so the only rejection left is an
 * unusable url. The mapping stays explicit so that adding a third
 * `BookmarkCreateError` is a type error here rather than a silently wrong
 * reason in the report.
 */
function reasonForCreateError(error: BookmarkCreateError): SkipReason {
  return error === "empty-title" ? "empty-title" : "unsafe-url";
}

/**
 * Imports a uTab export into `targetFolderId`. Each export folder becomes a
 * Chrome subfolder of the target; its bookmarks become Chrome bookmarks inside
 * that subfolder. Icons come from each entry's base64 `preview`. Structurally
 * invalid input creates nothing.
 *
 * A blank folder name is defaulted and a blank bookmark title falls back to its
 * url, so neither is a skip; an element with no url at all is an empty grid slot
 * and is ignored entirely. What remains skipped and counted is an entry whose
 * url the safe-scheme allowlist rejects. Grid placement is left to the
 * background onCreated listener, so this never writes positions itself.
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
      const exportName = asString(folder?.name).trim();
      const folderName =
        exportName.length > 0 ? exportName : DEFAULT_FOLDER_NAME;

      const folderResult = await createFolder(targetFolderId, folderName);
      if (!folderResult.ok) {
        // Unreachable by construction: createFolder rejects only a blank title,
        // and folderName is defaulted above so it never is one. Treated as an
        // invariant violation rather than a per-entry skip — a blank name is no
        // longer a user-data problem a report row could help with — so it goes
        // to the fatal path via the enclosing catch.
        //
        // This is what retired the `parent-skipped` rows the uTab importer used
        // to emit for a dropped folder's bookmarks: no folder is dropped any
        // more. The reason stays in the shared SkipReason union because state
        // transfer still emits it.
        throw new Error(
          `createFolder rejected a defaulted folder name: ${folderResult.error}`,
        );
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
        // Must precede the title fallback: a slot has no url, so substituting
        // one would leave the title blank anyway — but the check is what keeps
        // placeholders out of the loop entirely.
        if (isEmptySlot(bookmark)) continue;
        const title = asString(bookmark?.title);
        const url = asString(bookmark?.url);
        // uTab stores no title for some entries. The url is the only
        // identifying information such an entry has, so it becomes the title
        // rather than the entry being dropped. The *full* url, never the
        // hostname: entries that share a host and differ only by path are
        // common, and a hostname title would render them indistinguishable —
        // the exact confusion this fallback exists to prevent.
        const usesUrlAsTitle = title.trim().length === 0;
        const bookmarkResult = await createBookmark(
          folderResult.node.id,
          usesUrlAsTitle ? url : title,
          url,
        );
        if (!bookmarkResult.ok) {
          skipped++;
          rows.push({
            status: "skipped",
            id: asId(bookmark?._id),
            folder: folderName,
            // The source entry's own title, not the substituted one: the row's
            // job is to point back at the entry in the user's file.
            title,
            url,
            reason: reasonForCreateError(bookmarkResult.error),
          });
          continue;
        }
        bookmarksCreated++;
        if (usesUrlAsTitle) {
          // A raw url reads badly under an icon, so show it on hover instead.
          // Only for substituted titles — a real title keeps the default.
          await setBookmarkLabelDisplay(bookmarkResult.node.id, "tooltip");
        }
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
