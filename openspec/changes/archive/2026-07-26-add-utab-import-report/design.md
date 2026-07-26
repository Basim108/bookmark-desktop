## Context

`src/lib/import/utab.ts` imports a uTab JSON export into a selected folder. It
returns `{ foldersCreated, bookmarksCreated, skipped }` — three integers — and
`FolderSettingsWindow` renders them as a sentence. A ~1000-entry import reported
783 skips with no way to learn which entries or why.

Three existing behaviours make this worse than a missing feature:

1. **Icon failures vanish.** `attachPreviewIcon` (`utab.ts:72-84`) returns early
   on a non-string `preview`, an undecodable data url, or a failed
   `validateIconFile`. All three are indistinguishable from "no icon supplied".
2. **`_id` is discarded on purpose.** `utab.ts:11-13` documents that uTab's
   `_id`/`id`/remote `icon` fields are intentionally ignored. Correct for
   creation; wrong for reporting, since `_id` is the only stable handle back
   into the user's source file.
3. **No error handling exists.** `handleImportFileChange`
   (`FolderSettingsWindow.tsx:171-194`) has no `try`/`catch`. Its sibling
   `handleImportFile` in `GeneralSettingsWindow.tsx:138` does. Any rejection
   from `chrome.bookmarks.create` or `putIcon` escapes as an unhandled promise,
   `setImporting(false)` never runs, and the dialog pends forever.

The state-transfer feature already solved the same reporting problem, and this
change is largely a generalization of its parts rather than new machinery:

| Piece | Location | Reuse |
| --- | --- | --- |
| Object-URL anchor download | `transfer/download.ts:6` `downloadJson` | Pattern; needs a CSV sibling |
| Report file naming | `transfer/download.ts:42` `reportFileName` | Needs an extension parameter |
| Skip vocabulary | `transfer/types.ts:64` `SkipReason` | Extend with two members |
| Download-then-acknowledge UI | `GeneralSettingsWindow.tsx:150-156` | Pattern for the summary |

## Goals / Non-Goals

**Goals:**

- Every uTab import that records a skip, warning, or error produces a
  downloadable per-entry report naming what happened and why.
- A crashed import produces a report of what it managed to do, and ends with a
  visible summary rather than a hung dialog.
- Failures that are currently silent (icon decode/validation) become visible
  without changing whether their item is imported.
- The report is safe to open in a spreadsheet given fully untrusted input.
- Make the remaining uTab-import questions empirically answerable: the file
  should reveal whether the 783 skips are scheme-less urls, `chrome://` urls,
  or genuinely blank titles.

**Non-Goals:**

- Changing *which* entries are skipped. Blank-title fallback to url is a
  separate change; this one reports current behaviour faithfully.
- Grid placement of imported bookmarks — see
  `openspec/changes/place-bookmarks-at-real-grid-capacity/`. Placement happens
  in the service worker *after* `importUtabExport` returns, so the report
  cannot observe placement outcomes at all. This is a real limit of the
  feature, not an oversight.
- Batching or parallelising import. Sequential creation is deliberate: it
  avoids flooding Chrome with events and avoids races. Performance is out of
  scope.
- Retrying, resuming, or undoing a failed import.

## Decisions

### 1. Accumulate rows incrementally; emit from `finally`

The importer builds a `ReportRow[]` as it goes and the caller writes the file in
a `finally`, rather than assembling a report from a returned result on the
success path.

*Why:* the case that most needs a log is the crash, and a success-path-only
report produces nothing exactly then. This decision drives the shape of the
whole feature — `importUtabExport` must surface accumulated rows even when it
throws.

*Alternative considered:* return rows in the result object and write on success.
Simpler signature, but silently useless for fatal errors. Rejected.

*Consequence:* the rows must be reachable from the catch site. Either
`importUtabExport` catches internally and returns a result carrying both the
partial summary and rows, or it accepts a caller-owned array to append to. The
former keeps the error boundary inside the importer where the row-building
context lives; prefer it unless implementation shows otherwise.

### 2. One tabular file with a `status` column

Columns: `status`, `id`, `folder`, `bookmark-title`, `bookmark-url`,
`skipping-reason`, `error`. `status` is `skipped` | `warning` | `fatal`.

*Why:* three distinct things need recording — entries dropped, entries imported
with a degraded icon, and the error that ended the run. A skipped-only file plus
a trailing free-text error line stops being uniformly tabular and cannot be
loaded by a spreadsheet or parsed by a script.

*Consequence:* the summary's skip count must filter on `status === "skipped"`,
not `rows.length`. An import with only icon warnings reports zero skips and
still downloads a file.

### 3. CSV content in a `.log` file

The file is named `<base>-report.log` and contains CSV.

*Why:* explicit user decision, made with the mismatch flagged. `.log` will not
be associated with a spreadsheet application, so double-clicking opens a text
editor and no tool auto-parses it as CSV. The user accepted this trade-off.

*Implementation note:* `reportFileName` hardcodes `-report.json`
(`download.ts:42`). It gains an extension parameter; the existing state-transfer
call site must keep producing `-report.json` unchanged.

### 4. Escape every field: formula prefix + RFC 4180 quoting

A field starting with `=`, `+`, `-`, `@`, tab, or CR is prefixed so a
spreadsheet treats it as text. Any field containing a comma, double quote, or
newline is quoted with embedded quotes doubled.

*Why:* titles and urls come from a file the extension did not produce and
cannot trust, and the entire purpose of the report is to be opened by a human.
A uTab entry titled `=HYPERLINK("http://evil","click")` would otherwise execute
on open in Excel. RFC 4180 quoting is separately required for correctness —
bookmark titles routinely contain commas.

*Alternative considered:* quoting only, skipping the formula prefix. Smaller,
but leaves a live injection path in a file built entirely from untrusted input.
Rejected.

*Consequence:* this belongs in its own module with its own unit tests, not
inlined into the importer. The two concerns compose in a fixed order — decide
the formula prefix first, then quote the result — and getting that order wrong
is a silent correctness bug.

### 5. Extend the shared `SkipReason` rather than fork

`transfer/types.ts:64` gains `create-failed` and `icon-failed` alongside
`empty-title`, `unsafe-url`, `parent-skipped`, `root-unavailable`.

*Why:* a user who runs both importers should not receive two differently-shaped
reports from one extension.

*Alternative considered:* a parallel uTab-specific union in `src/lib/import/`.
Keeps the two importers free to diverge, at the cost of near-duplicate
vocabularies. Rejected.

*Consequence, and the main cost of this decision:* the union becomes a superset
neither importer emits in full. `root-unavailable` is state-transfer-only.
`empty-title` will go dead for uTab once the blank-title fallback lands, while
staying live for state transfer. The type therefore needs a comment stating
which reasons each importer can actually produce — otherwise the next reader
reasonably assumes both emit all six. The two importers are now coupled and
must be changed together.

### 6. `folder` is empty for bookmarks orphaned by a blank-named folder

When a folder is skipped, its bookmarks are skipped with it
(`utab.ts:120-123`). Those rows carry reason `parent-skipped` and an empty
`folder` column.

*Why:* the folder's name was blank — that blankness is precisely why it failed.
There is nothing truthful to print. `parent-skipped` already exists in the
shared vocabulary and says exactly this.

### 7. No report on whole-file rejection

`invalid-json` and `not-utab` produce no file.

*Why:* nothing was attempted, so there are no per-entry rows. The existing
inline message ("That file isn't valid JSON") already tells the user everything
the report could. Downloading a one-line file after a wrong-file misclick is
noise.

### 8. Reuse the download-then-acknowledge UI pattern

`GeneralSettingsWindow.tsx:150-156` downloads the report, shows a summary
naming the file, and defers its reload until the user acknowledges — because
reloading would erase the message. The uTab flow calls `onSaved()` rather than
reloading, so it is less fragile, but the summary must still name the file.

## Risks / Trade-offs

- **`.log` holding CSV misleads tooling and users** → Accepted, explicitly, by
  the user. The header line makes the format self-describing to anyone who
  opens it.
- **Extending `SkipReason` couples two importers** → Accepted. Mitigated by
  documenting per-importer applicability on the type itself; both importers'
  tests must cover their own reason subset.
- **Reversing the "ignore `_id`" decision reintroduces untrusted input** →
  `_id` is `unknown` and may be absent or non-string. Coerce exactly as
  `asString` (`utab.ts:86`) already does for titles, and never use it for
  anything but a report cell.
- **A large report could be slow to build** → 783 rows is trivial. Bounded by
  the export size, and the report is built once at the end. No mitigation
  needed, but avoid `String +=` accumulation over rows for the same reason
  `blobToDataUrl` chunks (`dataUrl.ts:47`).
- **Catching all errors could mask a bug** → A `fatal` row records the error
  detail rather than swallowing it, and the import still stops rather than
  continuing in an unknown state. The current behaviour — an unhandled
  rejection and a hung dialog — is strictly worse.
- **The report cannot see placement failures** → Genuine gap. Placement runs in
  the service worker after the importer returns, so a bookmark can be reported
  as imported and still end up mispositioned or unplaced. Documented as a
  non-goal; addressed by the separate placement change.

## Migration Plan

No data migration. No storage schema change. No new permission — the download
uses the existing in-page object-URL anchor.

The only backward-compatibility constraint is `reportFileName`: the
state-transfer call site must keep producing `-report.json`, so the new
extension parameter needs a default matching today's behaviour, and the existing
`download.test.ts` cases must pass unchanged.

Rollback is removal of the feature; nothing persists between imports.

## Open Questions

- Should `status` lead or trail the header row? Leading reads better when
  scanning a text editor — which, given the `.log` extension, is how this file
  will usually be opened. Safe to settle during implementation.
- Should `create-failed` rows include Chrome's own error message in `error`?
  It is the most diagnostic field available, but its text is unstable across
  Chrome versions and should not be assertable in tests.
- Once this ships, running it against the user's real uTab export answers the
  standing questions in `openspec/changes/rework-utab-import/design.md`
  Thread 1: what share of the 783 skips are scheme-less urls like `google.com`
  (which `new URL()` rejects by throwing), `chrome://` urls, or genuinely blank
  titles. Those answers shape the blank-title change and should be gathered
  before it is proposed.
