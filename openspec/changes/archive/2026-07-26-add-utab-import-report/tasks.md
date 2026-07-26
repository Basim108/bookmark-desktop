## 1. CSV serialization (standalone, no dependencies)

- [x] 1.1 Create `src/lib/import/csv.ts` with a field-escaping function: prefix a field whose value begins with `=`, `+`, `-`, `@`, tab, or CR so a spreadsheet treats it as text, then apply RFC 4180 quoting (wrap in double quotes and double any embedded quote) when the value contains a comma, double quote, CR, or LF. Order matters — prefix first, then quote the result.
- [x] 1.2 Add a row/table serializer in the same module that joins escaped fields with commas and rows with CRLF, emitting the header line first.
- [x] 1.3 Write `src/lib/import/csv.test.ts` covering: plain values pass through; a title containing a comma is quoted; an embedded double quote is doubled; an embedded newline keeps the row intact; each of `=`, `+`, `-`, `@`, tab, CR triggers the formula prefix; a formula-shaped value that *also* contains a comma gets both treatments in the right order; empty and undefined fields serialize as empty.

## 2. Report row model and shared reason vocabulary

- [x] 2.1 Extend `SkipReason` in `src/lib/transfer/types.ts` with `create-failed` and `icon-failed`.
- [x] 2.2 Document on that type which reasons each importer can actually emit — the union is now a superset neither uses in full (`root-unavailable` is state-transfer only; `empty-title` is emitted by both today but goes dead for uTab once the blank-title fallback lands). Without this note the next reader assumes both emit all six.
- [x] 2.3 Verify the existing state-transfer tests still pass unchanged — extending the union must not alter its behavior.
- [x] 2.4 Define the uTab report row type in `src/lib/import/utab.ts` (or a sibling module): `status` (`skipped` | `warning` | `fatal`), `id`, `folder`, `title`, `url`, `reason`, `error`.

## 3. Report file naming and download

- [x] 3.1 Add an extension parameter to `reportFileName` in `src/lib/transfer/download.ts`, defaulting to `.json` so the existing state-transfer call site is unchanged.
- [x] 3.2 Add a `downloadCsv`-style helper beside `downloadJson`, reusing the same transient object-URL anchor so no `chrome.downloads` permission is needed and nothing leaves the device.
- [x] 3.3 Extend `src/lib/transfer/download.test.ts`: the existing `-report.json` cases still pass; a `.log` extension produces `<base>-report.log`; a dotless input name is handled as before.

## 4. Importer: record rows

- [x] 4.1 Read the source entry's uTab `_id` in `src/lib/import/utab.ts`, coercing it the way `asString` already coerces titles — it is untrusted `unknown` and may be absent. Update the comment at `utab.ts:11-13` that currently states `_id` is intentionally ignored, so the reversal is explicit rather than a silent contradiction.
- [x] 4.2 Record a `skipped` row wherever the importer currently increments `skipped`: a folder with a blank name, each bookmark orphaned by that folder (reason `parent-skipped`, empty `folder` column), and each bookmark rejected by `createBookmark` (mapping its `empty-title` / `unsafe-url` error to the reason).
- [x] 4.3 Change `attachPreviewIcon` to report rather than swallow: a `preview` that is present but fails to decode or fails `validateIconFile` produces a `warning` row with reason `icon-failed`. An absent `preview` is not a warning. The item is still created either way.
- [x] 4.4 Wrap the import loop so a thrown `chrome.bookmarks.create` or `putIcon` rejection is caught, appended as a `fatal` row carrying the error detail, and ends the import — returning the partial summary and the rows accumulated so far rather than propagating.
- [x] 4.5 Return the accumulated rows alongside the existing summary, keeping the `invalid-json` / `not-utab` structural-failure results unchanged (no rows, no file).

## 5. Importer unit tests

- [x] 5.1 Extend `src/lib/import/utab.test.ts`: a blank-name folder and its bookmarks produce rows with the expected reasons and an empty `folder` for the orphans; an unsafe url produces a `skipped` row; a valid entry produces no row.
- [x] 5.2 Test that a failing `preview` produces a `warning` row while the bookmark is still created, and that an absent `preview` produces no row at all.
- [x] 5.3 Test that a rejecting `chrome.bookmarks.create` ends the import with a `fatal` row and preserves the rows recorded before it — the partial-report guarantee.
- [x] 5.4 Test that a clean import returns zero rows, and that `invalid-json` / `not-utab` return no rows.

## 6. UI wiring

- [x] 6.1 Wrap `handleImportFileChange` in `src/newtab/components/FolderSettingsWindow.tsx:171` in `try`/`catch`/`finally` so `setImporting(false)` always runs — today an unhandled rejection leaves the dialog pending forever. Mirror `handleImportFile` in `GeneralSettingsWindow.tsx:138`.
- [x] 6.2 Download the report from the `finally` when at least one row was recorded, naming it via `reportFileName(file.name, ".log")`.
- [x] 6.3 Update the summary text to name the downloaded report file, and count skips as `status === "skipped"` only — an import with only icon warnings reports zero skips and still downloads a file.
- [x] 6.4 Extend `src/newtab/components/FolderSettingsWindow.test.tsx`: the summary names the report file when rows exist; no download and no file name when the import is clean; the busy state clears when the importer throws.

## 7. Verification

- [x] 7.1 Run `npm run typecheck`, `npm run lint`, and `npm test`; all must pass.
- [x] 7.2 Run `npm run test:e2e` to confirm the extension still builds and loads, and that no existing import e2e coverage (`e2e/import-utab.spec.ts`) regressed.
- [x] 7.3 (Done via an automated real-Chromium e2e test rather than a manual pass — see e2e/import-utab.spec.ts "downloads a per-entry report file".) Import a real uTab export end-to-end in a browser; confirm the `.log` file downloads, its header line is present, and rows are readable. Verify a title beginning with `=` appears prefixed in the file.
- [x] 7.4 (Partial: the scheme-less-url finding is confirmed and recorded; the per-category *share* of the user's 783 skips still needs their real export.) Record what the report reveals about the user's ~783 skips (share that are scheme-less urls like `google.com`, `chrome://` urls, or genuinely blank titles) in `openspec/changes/rework-utab-import/design.md` — those numbers are what the blank-title change is waiting on.
