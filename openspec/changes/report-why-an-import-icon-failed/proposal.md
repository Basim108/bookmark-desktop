## Why

The import report has an `error` column that only fatal rows ever fill. Every
`icon-failed` warning row leaves it empty, so the report says an icon failed and
never says why.

This is measurable on the user's real export
(`design/examples/uTab_settings_26-07-2026-report.log`): 6 `icon-failed` rows,
all with an empty `error` cell. The user is told six previews were unusable and
given nothing to act on — the file is the whole point of the report, and for
those six rows it is a dead end.

The information exists and is thrown away. `attachPreviewIcon`
(`src/lib/import/utab.ts`) collapses three distinct outcomes into a bare
`false`:

```
  preview is not a decodable base64 data URL   →  dataUrlToBlob returns undefined
  preview decodes but is not PNG/JPEG/WebP/AVIF →  validateIconFile: unsupported-format
  preview decodes but exceeds the 1 MB cap      →  validateIconFile: file-too-large
```

The last two already have names — `IconValidationError` is exactly
`"unsupported-format" | "file-too-large"` — and are discarded one line after
being produced. Only the first is unnamed.

Raised as an open question during the uTab import work on 2026-07-26 and left
unclaimed by every change since. It is the last actionable item in
`rework-utab-import`.

## What Changes

- `attachPreviewIcon` SHALL report *which* failure occurred rather than a
  boolean, and the importer SHALL record it in the report row's `error` column.
- The two validation failures SHALL be reported under their existing
  `IconValidationError` names, not a second vocabulary invented for the report.
- The decode failure SHALL be named `undecodable-preview`, covering both a
  string that is not a base64 data URL at all and one whose base64 payload does
  not decode. `dataUrlToBlob` already treats these as one category and returns
  `undefined` for both; splitting them would mean changing its return type for
  a distinction the report does not need.
- This applies to folder previews and bookmark previews alike — both call the
  same helper and both currently produce blank `error` cells.

### Not doing

- **No change to what is imported.** A failed preview still leaves its folder or
  bookmark created with the default icon, still counts as a `warning` and not a
  skip. Only the diagnostic text changes.
- **No new failure modes surfaced.** `putIcon` rejecting on IndexedDB quota
  continues to propagate to the fatal path rather than becoming an icon warning;
  it ends the import rather than degrading one item.
- **No human-phrased messages.** `ICON_ERROR_MESSAGES` exists but is written for
  an upload dialog ("use PNG, JPEG, WebP, or AVIF"), which reads as misdirected
  advice in a report about an embedded preview the user never chose.

### Scope added during implementation

`IconValidationResult` was `{ ok: boolean; error?: IconValidationError }` — a
shape claiming a failure might carry no reason, which none of its three failing
paths ever produces. That optional field is precisely what blocked passing the
reason through: a caller wanting the error had to handle an `undefined` the code
cannot emit. It is now a discriminated union, and no consumer needed changing.

This was listed as out of scope when the proposal was written. It turned out to
be the thing standing in the way, so it is in — recorded here rather than
slipped in silently.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bookmark-import`: **Import Report Records Non-Fatal Icon Failures** currently
  requires only that the failure be recorded as a `warning` row. It gains the
  requirement that the row identify which failure occurred, and names the three
  values.

## Impact

**Code**

- `src/lib/import/utab.ts` — `attachPreviewIcon` returns a discriminated result
  instead of `boolean`; both call sites pass the reason into the row's `error`.
- No change to `src/lib/import/report.ts`: the `error` column already exists and
  is already escaped by the injection-safe formatting.
- `src/lib/icons/validation.ts` — `IconValidationResult` becomes a discriminated
  union; see "Scope added during implementation". No behaviour change and no
  consumer changes.
- No change to `dataUrlToBlob` or to any validation logic.

**Tests**

- `src/lib/import/utab.test.ts` — one test per failure mode, asserting the
  specific value in the row's `error`, for a bookmark preview and a folder
  preview.
- A successful preview still produces no row at all.

**Not affected**

Import counts, the summary line, which items get created, and the report's
column set.
