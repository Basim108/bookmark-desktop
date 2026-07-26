## Why

A real uTab import of ~1000 entries reported "Imported 12 folders, 213
bookmarks — skipped 783" and nothing else. The user has no way to learn *which*
783 entries were dropped or why, and no way to recover them — the count is a
single opaque integer.

Worse, the importer has no error handling at all. `FolderSettingsWindow`'s
`handleImportFileChange` (`src/newtab/components/FolderSettingsWindow.tsx:171`)
wraps nothing in `try`/`catch`, unlike its sibling `handleImportFile` in
`GeneralSettingsWindow`. `importUtabExport` awaits `chrome.bookmarks.create`
(rejects on quota, or on a url Chrome itself refuses) and `putIcon` (rejects on
IndexedDB quota — very live when importing hundreds of base64 icons). Neither
rejection is caught anywhere in the chain, so **a mid-import failure today
leaves the dialog stuck on "Importing…" forever, with no message, no summary,
and no indication of what was or was not created.**

This is also the enabling step for the rest of the uTab import work: several
open questions about *why* entries are being skipped (scheme-less urls like
`google.com`, `chrome://` urls, genuinely blank titles) are empirical, not
architectural. A per-entry report answers them permanently and self-service
instead of via a one-off diagnostic.

## What Changes

- On every uTab import that produces at least one skipped entry, warning, or
  fatal error, the extension downloads a report file named
  `<import-file-name-without-extension>-report.log`, alongside the existing
  inline summary.
- The report is CSV-formatted with a header line and these columns:
  `status`, `id`, `folder`, `bookmark-title`, `bookmark-url`,
  `skipping-reason`, `error`.
  - `status` is `skipped` | `warning` | `fatal`. The inline summary's skip
    count counts only `skipped` rows.
  - `id` is the uTab `_id` of the source entry, which the importer currently
    discards on purpose (`src/lib/import/utab.ts:11-13`); that decision is
    reversed and the comment updated.
- `warning` rows capture non-fatal failures that currently vanish silently:
  an entry's `preview` icon that fails to decode or validate is swallowed at
  `src/lib/import/utab.ts:77-81`, and the item imports with a default icon.
  The item is *not* skipped; the warning is recorded.
- The importer gains real error handling. A thrown `chrome.bookmarks.create` or
  `putIcon` rejection is caught, recorded as a `fatal` row, and ends the import
  cleanly with the report written and the summary shown — instead of hanging
  the dialog.
- Report rows are accumulated incrementally and emitted from a `finally`, so a
  crashed import still reports what it managed to do. Building the report only
  on the success path would produce no log in exactly the case that most needs
  one.
- Every field is escaped against CSV/formula injection (a leading `'` when the
  value starts with `=`, `+`, `-`, `@`, tab, or CR) and RFC 4180-quoted for
  embedded commas, quotes, and newlines. Titles and urls come from an untrusted
  file and are rendered for a human in a spreadsheet.
- The shared `SkipReason` union (`src/lib/transfer/types.ts:64`) is extended
  with `create-failed` and `icon-failed` rather than forking a parallel
  uTab-specific vocabulary.
- `reportFileName` (`src/lib/transfer/download.ts:42`) gains an extension
  parameter; it currently hardcodes `-report.json`.
- No report file is written when the whole file is rejected (`invalid-json` /
  `not-utab`) — nothing was attempted, and the existing inline message suffices.
- Successfully imported entries are **not** listed. The report covers only what
  needs attention.

Not in scope: changing which entries are skipped (blank-title fallback is a
separate change), and grid placement of imported bookmarks (see
`openspec/changes/place-bookmarks-at-real-grid-capacity/`).

## Capabilities

### New Capabilities

None. This extends an existing capability.

### Modified Capabilities

- `bookmark-import`: The "Skip-and-Report of Invalid Entries" requirement gains
  a downloadable per-entry report file alongside the existing inline summary.
  Two new requirements are added: one for the report file's name, format,
  columns, and injection-safe escaping; one for import error handling, which
  currently does not exist — a mid-import rejection must be recorded and
  surfaced rather than hanging the dialog.

## Impact

**Code**
- `src/lib/import/utab.ts` — accumulate report rows; stop discarding `_id`;
  record icon-validation failures as warnings instead of swallowing them; catch
  and record fatal errors; return rows alongside the summary.
- `src/newtab/components/FolderSettingsWindow.tsx:171` — add `try`/`catch`,
  trigger the download, and surface the report file name in the summary.
- `src/lib/transfer/download.ts` — extension parameter on `reportFileName`; a
  new CSV download helper beside the existing `downloadJson`.
- `src/lib/transfer/types.ts` — extend `SkipReason` with `create-failed` and
  `icon-failed`; document which reasons each importer can actually emit, since
  the union becomes a superset neither uses in full.
- New: a CSV serialization module (RFC 4180 quoting + formula-injection
  prefixing) with its own unit tests.

**Behavior**
- Downloads use the existing object-URL anchor approach, so **no new
  `chrome.downloads` permission** is required and nothing leaves the device.
- An import that previously appeared to hang will now complete with an error
  report. No existing successful import changes its outcome.

**Coupling**
- Extending the shared `SkipReason` couples the uTab importer and the
  state-transfer importer; they must now be changed together. The
  `state-transfer` capability's *behavior* is unchanged, so it needs no spec
  delta.
