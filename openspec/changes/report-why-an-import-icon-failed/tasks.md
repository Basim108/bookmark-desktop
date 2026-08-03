## 1. Report the reason

- [x] 1.1 Change `attachPreviewIcon` (`src/lib/import/utab.ts`) to return a discriminated result — `{ ok: true } | { ok: false; error: PreviewIconError }` — rather than `boolean`. Match the shape `validateIconFile` and `createBookmark` already use rather than returning `string | undefined`, which would make the success path the falsy one.
- [x] 1.2 Define `PreviewIconError` as `IconValidationError | "undecodable-preview"`. Reference the existing type rather than copying its members, so a future validation error surfaces in the report automatically and a removed one fails to typecheck.
- [x] 1.3 Keep "no preview at all" as `{ ok: true }` — an absent icon is not a failure and must still produce no row.
- [x] 1.4 Pass the reason into the `error` field of the `warning` row at both call sites: the folder preview and the bookmark preview.
- [x] 1.5 Leave `putIcon` rejections propagating to the enclosing `catch` and the `fatal` path. Quota exhaustion is not an icon-validation failure and the next item would fail too, so it ends the import rather than degrading one entry.

- [x] 1.6 Tighten `IconValidationResult` (`src/lib/icons/validation.ts`) into a discriminated union. Its optional `error` claimed a failure could carry no reason — a state none of its failing paths produces — and that is what forces a caller wanting the reason to invent a value for an unreachable branch. No consumer changes; no behaviour change.

## 2. Tests

- [x] 2.1 A bookmark whose `preview` is not a data URL at all produces a `warning` row with `error` = `undecodable-preview`, and the bookmark is still created.
- [x] 2.2 A bookmark whose `preview` is a data URL with an undecodable base64 payload produces the same value. **Note:** the payload must use characters outside the base64 alphabet (`@@@@`). Two pre-existing tests used `zzzz` and described it as undecodable — it is valid base64, decodes to three bytes, and is rejected by the format sniff instead. Both were corrected, and one now documents the distinction.
- [x] 2.3 A bookmark whose `preview` decodes to an unsupported format produces `error` = `unsupported-format`.
- [x] 2.4 A bookmark whose `preview` exceeds the size cap produces `error` = `file-too-large`.
- [x] 2.5 A folder preview failure is reported identically — the folder path is a separate call site and would not be covered by the bookmark tests.
- [x] 2.6 An entry with no `preview` produces no row.
- [x] 2.7 A successful preview still produces no row, and the icon is still attached.

## 3. Verification

- [x] 3.1 `npm run typecheck && npm run lint && npm run format`
- [x] 3.2 `npm test`
- [x] 3.3 `npm run test:e2e`
- [x] 3.4 Confirm nothing else changed: import counts, the summary line, which items get created, and the report's column set are all untouched.
- [x] 3.5 Context re-read. The e2e report assertion is the strongest evidence the gap is closed: it previously asserted a row ending `icon-failed,` with an empty cell, and now asserts `icon-failed,unsupported-format`. That test was encoding the bug.

## 4. Follow-ups (not this change)

- [ ] 4.1 `rework-utab-import` becomes fully spent once this lands — all four of its threads have shipped and this was its last unclaimed item. Worth archiving that exploration document rather than leaving it as an active change.
- [ ] 4.2 The report's `_id` column is not an opaque key: uTab's seeded default bookmarks use their url as `_id`, and ids repeat across folders. Harmless today, recorded in `rework-utab-import`'s design, and still unclaimed.
