## 1. Folder name fallback

- [x] 1.1 In `src/lib/import/utab.ts`, define the default folder name as a named constant (`"New Folder"`) rather than a literal at the call site, and note in a comment that it deliberately matches the create-folder draft window's heading (`FolderSettingsWindow.tsx:330`) so an imported unnamed folder reads the same as a manually created one.
- [x] 1.2 Substitute that default before `createFolder` (`utab.ts:150`) when the coerced folder name is empty after trimming. Do not touch `createFolder` itself — its guard also serves the New Folder window, where a blank name must stay rejected.
- [x] 1.3 Handle the branch this makes unreachable: `createFolder` returns `ok: false` only for `empty-title`, so its failure branch (`utab.ts:151-173`) and every `parent-skipped` row it emits can no longer be taken. Either delete the branch or keep it defensively — but state which, and why, in a comment. A reader will otherwise assume it still fires.
- [x] 1.4 Leave `parent-skipped` in the shared `SkipReason` union; state-transfer still emits it.

## 2. Bookmark title fallback

- [x] 2.1 Substitute the entry's full url for a blank title before `createBookmark` (`utab.ts:193`). Full url, not hostname — record why in a comment: two of the measured entries share `hrimsoft.atlassian.net` and differ only by path, so a hostname title would make them indistinguishable, which is the failure this fallback exists to prevent.
- [x] 2.2 Ensure the substitution runs *after* the empty-slot check from `ignore-utab-empty-slots` and *before* `createBookmark`. Reversed, every placeholder would get `title := ""` and the noise rows return. If that change has not landed yet, leave a comment marking where its guard belongs.
- [x] 2.3 After a successful create whose title was substituted, call `setBookmarkLabelDisplay(node.id, "tooltip")` (`storage/bookmarkSettings.ts:25`) so the url renders on hover rather than as canvas text. Only for substituted titles — a bookmark that had a real title keeps the `"under-icon"` default.
- [x] 2.4 Confirm the url-safety check still runs against the url itself and is unaffected by the substitution: a blank-titled `javascript:` entry must still be rejected as `unsafe-url`.

## 3. Vocabulary and dead-branch cleanup

- [x] 3.1 Update the note on `SkipReason` in `src/lib/transfer/types.ts` that `add-utab-import-report` left predicting `empty-title` "goes dead for uTab once the blank-title fallback lands" — this is that change; make it a statement of fact. Keep `empty-title` in the union for state-transfer.
- [x] 3.2 Resolve `reasonForCreateError` (`utab.ts:112`): with `empty-title` unreachable it always returns `unsafe-url`. Simplify it or keep it total and defensive, but do not leave a branch that can no longer be taken looking live.

## 4. Unit tests

- [x] 4.1 Extend `src/lib/import/utab.test.ts`: a folder with an empty name, and one with a whitespace-only name, are each created as `"New Folder"`, are not counted as skipped, and produce no report row.
- [x] 4.2 Test that a blank-named folder's bookmarks are imported into it rather than dropped — the subtree-loss case is the main reason the folder half exists.
- [x] 4.3 Test that two blank-named folders both import, producing two folders named `"New Folder"`.
- [x] 4.4 Test that a bookmark with a safe url and a blank title is created with the full url as its title, is not counted as skipped, and produces no report row.
- [x] 4.5 Test that such a bookmark gets `labelDisplay: "tooltip"`, and that a bookmark with a real title does not — the setting must not be written for every imported bookmark.
- [x] 4.6 Test the safety boundary: a blank title with an unsafe url is still skipped with reason `unsafe-url`, and a blank title with a scheme-less url likewise. This is what stops the fallback from becoming a bypass.
- [x] 4.7 Confirm the existing `utab.test.ts` cases still pass; no entry that imports today may change how it imports.

## 5. End-to-end coverage

- [x] 5.1 Add a blank-titled, safe-url entry and a blank-named folder to the fixture in `e2e/import-utab.spec.ts`; assert both appear on the canvas after import and that neither produces a report row.
- [x] 5.2 Assert the rescued bookmark renders without a label under its icon, so the tooltip behaviour is verified in a real browser rather than only at the storage layer.
- [x] 5.3 Assert the existing scheme-less row `skipped,b-schemeless,"Reading, Writing",Scheme Less,google.com,unsafe-url,` (`e2e/import-utab.spec.ts:151`) is still present and unchanged — it is the boundary marker for this change.
- [x] 5.4 Assert the summary's skipped count drops accordingly, so the user-visible number is covered and not only the file.

## 6. Verification

- [x] 6.1 Run `npm run typecheck`, `npm run lint`, and `npm test`; all must pass.
- [x] 6.2 Run `npm run test:e2e` and confirm `e2e/import-utab.spec.ts` passes with the new fixture entries.
- [x] 6.3 Re-import the user's real uTab export and confirm the 25 previously lost bookmarks now appear, each icon-only with its url on hover. Record the actual before/after counts in `design.md`.
- [x] 6.4 Confirm the spec delta still applies cleanly against `openspec/specs/bookmark-import/spec.md`. It is written against that spec **as modified by `ignore-utab-empty-slots`**; if this change archives first, rebase one delta onto the other — both modify "Skip-and-Report of Invalid Entries".
