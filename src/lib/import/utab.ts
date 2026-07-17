import { createBookmark, createFolder } from "../bookmarks/create";
import { validateIconFile } from "../icons/validation";
import { setBookmarkHasCustomIcon } from "../storage/bookmarkSettings";
import { setFolderHasCustomIcon } from "../storage/folderSettings";
import { putIcon } from "../storage/iconDb";
import { dataUrlToBlob } from "./dataUrl";

/**
 * The subset of a uTab export this importer reads. Everything is typed as
 * `unknown` because the input is an untrusted file: each field is checked
 * before use rather than trusting the export's shape. uTab also emits `_id`,
 * `id`, and a remote `icon` URL per bookmark; those are intentionally ignored
 * (only the embedded base64 `preview` is used, avoiding any network fetch).
 */
interface UtabBookmark {
  title?: unknown;
  url?: unknown;
  preview?: unknown;
}

interface UtabFolder {
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
  | { ok: true; summary: UtabImportSummary }
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
 * created node's custom icon. Any failure — missing/non-string preview, a
 * preview that doesn't decode, or one that fails validation — is swallowed so
 * the folder/bookmark still imports and simply falls back to its default icon.
 */
async function attachPreviewIcon(
  itemId: string,
  preview: unknown,
  setHasCustomIcon: (id: string, value: boolean) => Promise<void>,
): Promise<void> {
  if (typeof preview !== "string") return;
  const blob = dataUrlToBlob(preview);
  if (!blob) return;
  const result = await validateIconFile(blob);
  if (!result.ok) return;
  await putIcon(itemId, blob);
  await setHasCustomIcon(itemId, true);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
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

  for (const folder of parsed.folders) {
    const bookmarks = Array.isArray(folder?.bookmarks) ? folder.bookmarks : [];

    const folderResult = await createFolder(
      targetFolderId,
      asString(folder?.name),
    );
    if (!folderResult.ok) {
      // Can't create the folder → its bookmarks have nowhere to go; count the
      // folder and every bookmark it would have held as skipped.
      skipped += 1 + bookmarks.length;
      continue;
    }
    foldersCreated++;
    await attachPreviewIcon(
      folderResult.node.id,
      folder?.preview,
      setFolderHasCustomIcon,
    );

    for (const bookmark of bookmarks as UtabBookmark[]) {
      const bookmarkResult = await createBookmark(
        folderResult.node.id,
        asString(bookmark?.title),
        asString(bookmark?.url),
      );
      if (!bookmarkResult.ok) {
        skipped++;
        continue;
      }
      bookmarksCreated++;
      await attachPreviewIcon(
        bookmarkResult.node.id,
        bookmark?.preview,
        setBookmarkHasCustomIcon,
      );
    }
  }

  return { ok: true, summary: { foldersCreated, bookmarksCreated, skipped } };
}
