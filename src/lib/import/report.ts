import { toCsv } from "./csv";
import type { SkipReason } from "../transfer/types";
import type { UtabImportSummary } from "./utab";

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

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * Human-readable summary of an import, e.g.
 * "Imported 2 folders, 24 bookmarks — skipped 1. Details in utab-report.log."
 *
 * The skip count comes from the summary, not from the row count: an import can
 * record icon warnings with zero skips and still produce a report.
 *
 * Shared by both import entry points — the control inside a folder's settings
 * window and the root-folder row button. Kept here rather than in either
 * component so the two can never word the same outcome differently.
 */
export function formatImportSummary(
  summary: UtabImportSummary,
  rows: readonly ImportReportRow[],
  reportName?: string,
): string {
  const base = `Imported ${pluralize(summary.foldersCreated, "folder")}, ${pluralize(
    summary.bookmarksCreated,
    "bookmark",
  )}`;
  const failed = rows.some((row) => row.status === "fatal");
  const head = failed ? `${base} before the import failed` : base;
  const counted =
    summary.skipped > 0 ? `${head} — skipped ${summary.skipped}.` : `${head}.`;
  return reportName ? `${counted} Details in ${reportName}.` : counted;
}
