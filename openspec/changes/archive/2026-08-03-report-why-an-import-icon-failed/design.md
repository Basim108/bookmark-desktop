# Design — report-why-an-import-icon-failed

> Short by intent: the proposal settles the behaviour, and the only real choices
> here are the return shape and the vocabulary.

## Context

```ts
// src/lib/import/utab.ts — today
async function attachPreviewIcon(itemId, preview, setHasCustomIcon): Promise<boolean> {
  if (typeof preview !== "string" || preview.length === 0) return true;  // no preview: fine
  const blob = dataUrlToBlob(preview);
  if (!blob) return false;                                               // ← reason lost
  const result = await validateIconFile(blob);
  if (!result.ok) return false;                                          // ← reason lost, twice over
  await putIcon(itemId, blob);
  await setHasCustomIcon(itemId, true);
  return true;
}
```

`validateIconFile` returns `{ ok: false, error: IconValidationError }` and the
line that consumes it discards `error`. Both call sites then push a report row
whose `error` field is simply never set.

## Decisions

### 1. A discriminated result, not an error-or-null string

```ts
type PreviewIconOutcome = { ok: true } | { ok: false; error: PreviewIconError };
```

The alternative — returning `string | undefined` where `undefined` means success
— makes the success path the falsy one and inverts the existing call sites'
polarity. Matching the shape `validateIconFile` and `createBookmark` already use
in this codebase keeps one convention rather than two.

The "no preview at all" case stays `{ ok: true }`: an absent preview is not a
failure, and the existing behaviour of recording nothing for it is correct.

### 2. Reuse `IconValidationError` verbatim; add one name for the third case

`unsupported-format` and `file-too-large` already exist and are already the
words used elsewhere for these exact conditions. Renaming them for the report
would create a second vocabulary for one set of facts.

Only the decode failure is unnamed, and it becomes `undecodable-preview`.
`dataUrlToBlob` returns `undefined` both for a string that is not a base64 data
URL and for one whose payload fails `atob` — its own documentation treats these
as a single category, and distinguishing them would mean widening its return
type to serve a column that does not need the distinction.

### 3. Codes, not sentences

The `error` column gets the code. `ICON_ERROR_MESSAGES` maps these same codes to
user-facing prose, but that prose is written for the upload dialog — *"Unsupported
file type — use PNG, JPEG, WebP, or AVIF."* — which is advice about a file the
user chose. A uTab preview is embedded in an export they did not author, so the
instruction is misdirected.

Codes also match the report's neighbouring column: `skipping-reason` already
holds `empty-title` and `icon-failed`, so `error` holding `file-too-large` reads
consistently rather than as the one prose field in a table of identifiers.

### 4. `putIcon` failures stay fatal

`putIcon` can reject on IndexedDB quota. That is not an icon-validation failure
and not something the item can degrade past — it means storage is exhausted, so
subsequent items will fail too. It continues to propagate to the enclosing
`catch` and end the import with a `fatal` row, which is the existing behaviour
and the right one.

### 5. `IconValidationResult` is tightened into a discriminated union

Not foreseen when this was written. `{ ok: boolean; error?: IconValidationError }`
permits a failure with no reason, which none of the three failing paths in
`validateImageFile` produces — so the optional field described a state that does
not exist and made `result.error` an `IconValidationError | undefined` at exactly
the point this change needs the reason.

The alternatives were both worse: fabricate a fourth error code for an
unreachable branch, or fall back to one of the real codes and report a cause
that did not occur. Making the type match the implementation removes the
question. Verified no consumer needed changing.

## Risks / Trade-offs

**The report gains a vocabulary that must stay in step with
`IconValidationError`.** → It reuses that type rather than copying its values,
so adding a validation error surfaces in the report automatically and a removed
one fails to typecheck.

**`undecodable-preview` merges two distinguishable causes.** → Accepted per
decision 2. If a real export ever produces a confusing case, `dataUrlToBlob` can
be widened then; there is no evidence today that the distinction would help, and
all six failures in the measured export are yet to be attributed to any cause.

## Open Questions

None.
