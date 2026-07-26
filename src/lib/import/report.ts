import { toCsv } from "./csv";
import type { SkipReason } from "../transfer/types";

/**
 * What a report row records about an entry:
 * - `skipped` — the entry was not created.
 * - `warning` — the entry WAS created, but something about it degraded (today,
 *   only an unusable `preview` icon). Not counted in the summary's skip count.
 * - `fatal`   — an error ended the import; the row carries the error detail
 *   and has no entry fields.
 */
export type ImportRowStatus = "skipped" | "warning" | "fatal";

/** One row of the downloadable uTab import report. */
export interface ImportReportRow {
  status: ImportRowStatus;
  /** The source entry's uTab `_id`, when it had one. */
  id?: string | undefined;
  /**
   * The containing export folder's name. Empty for a bookmark orphaned by a
   * folder that was itself skipped for a blank name — the blankness is exactly
   * why it failed, so there is nothing truthful to print.
   */
  folder?: string | undefined;
  title?: string | undefined;
  url?: string | undefined;
  reason?: SkipReason | undefined;
  error?: string | undefined;
}

/**
 * Column order for the report. `status` leads so the file is scannable in a
 * text editor, which — given the `.log` extension — is how it will usually be
 * opened.
 */
const HEADER = [
  "status",
  "id",
  "folder",
  "bookmark-title",
  "bookmark-url",
  "skipping-reason",
  "error",
] as const;

/** Serializes report rows as CSV text, with every field escaped by toCsv. */
export function formatImportReport(rows: readonly ImportReportRow[]): string {
  return toCsv(
    HEADER,
    rows.map((row) => [
      row.status,
      row.id,
      row.folder,
      row.title,
      row.url,
      row.reason,
      row.error,
    ]),
  );
}
