## 1. Importer guard

- [x] 1.1 In `src/lib/import/utab.ts`, add a predicate that reports whether a uTab bookmark entry is an empty slot: true when its `url` is absent, not a string, or empty after trimming. Keep it beside `asString`/`asId` and name it for what it means (an empty grid slot), not for what it tests, so the call sites read as intent.
- [x] 1.2 Document on that predicate *why* it exists — a uTab export lists each folder's bookmarks as a fixed-size array with placeholder elements for unused grid positions, so the majority of a real export's `bookmarks` entries are not bookmarks. Without this note the guard reads as an arbitrary leniency. Cite the measured evidence (`design/examples/uTab_settings_26-07-2026-report.log`: 758 of 783 skips were url-less placeholders).
- [x] 1.3 Record on the predicate that the empty url is deliberately sufficient on its own, and that an entry carrying a title but no url is therefore dropped silently — an accepted trade-off, not an oversight. See `design.md`.
- [x] 1.4 Guard the main bookmark loop (`utab.ts:190`): an empty slot `continue`s without calling `createBookmark`, without incrementing `skipped`, and without pushing a row.
- [x] 1.5 Guard the orphaned-bookmark loop in the `createFolder` failure branch (`utab.ts:161`) the same way, and correct the `skipped += 1 + bookmarks.length` accounting above it (`:154`) so it counts only the folder plus its non-slot bookmarks. This site is easy to miss — the observed export never reached it because all 12 folders imported — but a single blank-named folder would otherwise put ~83 noise rows straight back into the report.

## 2. Importer unit tests

- [x] 2.1 Extend `src/lib/import/utab.test.ts`: an entry with a missing `url`, an entry with `""`, and an entry with a whitespace-only `url` each produce no bookmark, no report row, and no increment of `skipped`.
- [x] 2.2 Test the boundary in the other direction — an entry with a url but a blank `title` is still skipped and still reported, and an entry with a present-but-unsafe url is still skipped with reason `unsafe-url`. These two assertions are what stop the guard from widening later.
- [x] 2.3 Test the orphan path: a blank-named folder whose `bookmarks` array mixes empty slots with url-bearing entries reports `parent-skipped` rows only for the latter, and its skipped count reflects the folder plus those entries only.
- [x] 2.4 Test that an import whose only non-imported entries are empty slots returns zero rows and a zero skipped count — this is the case that must stop downloading a report file at all.
- [x] 2.5 Confirm the existing `utab.test.ts` cases still pass unchanged; nothing that imports today may stop importing.

## 3. End-to-end coverage

- [x] 3.1 Add a url-less entry to the fixture in `e2e/import-utab.spec.ts` (alongside the existing `b-schemeless` entry) and assert the downloaded report body contains no row for it.
- [x] 3.2 Assert the existing scheme-less row `skipped,b-schemeless,"Reading, Writing",Scheme Less,google.com,unsafe-url,` (`e2e/import-utab.spec.ts:151`) is still present and unchanged — it is the boundary marker between "no url" and "bad url".
- [x] 3.3 Assert the summary's skipped count in the e2e flow reflects the reduced number, so the user-visible number is covered and not only the file.

## 4. Specs and verification

- [x] 4.1 Run `npm run typecheck`, `npm run lint`, and `npm test`; all must pass.
- [x] 4.2 Run `npm run test:e2e` and confirm `e2e/import-utab.spec.ts` passes with the new fixture entry.
- [x] 4.3 Re-import the user's real uTab export and confirm the summary reports roughly 25 skipped rather than 783, and that the downloaded report is on the order of 31 rows rather than 789. This is the acceptance check the whole change exists for; record the actual numbers in `design.md`.
- [x] 4.4 While that export is open, count `folders[].bookmarks.length` to confirm the fixed 83-slot hypothesis, and note in `design.md` whether it held — the change is correct either way, but the reasoning behind it should not stay unverified.
