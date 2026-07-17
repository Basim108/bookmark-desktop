# Tasks

## 1. Bookmark creation path
- [x] 1.1 Add `src/lib/bookmarks/create.ts` with `createFolder(parentId, title)` and `createBookmark(parentId, title, url)` wrapping `chrome.bookmarks.create`, trimming/rejecting empty titles and gating urls through `isSafeNavigationUrl`; each returns the created `BookmarkTreeNode`.
- [x] 1.2 Unit-test `create.ts` (empty/whitespace title rejected, unsafe url rejected, safe url + valid title creates and returns the node) using the chrome mock.

## 2. Icon validation accepts a Blob
- [x] 2.1 Widen `validateImageFile`/`validateIconFile` in `src/lib/icons/validation.ts` to accept a `Blob` (File already satisfies it); confirm existing upload call sites are unchanged.
- [x] 2.2 Add `src/lib/import/dataUrl.ts` (or a helper) that decodes a base64 image data URL to a `Blob`, tolerating a missing/malformed data URL by returning undefined.
- [x] 2.3 Unit-test data-URL decoding (valid png data URL → Blob with correct type; non-data-URL / garbage → undefined) and Blob validation reuse.

## 3. uTab import core
- [x] 3.1 Add `src/lib/import/utab.ts`: parse JSON, validate the uTab shape (object with a `folders` array), and reject structurally-invalid input without creating anything.
- [x] 3.2 Drive the import: for each folder create a subfolder under the target id, then create each bookmark; decode → validate → `putIcon` + set-has-custom-icon for each valid `preview`; skip blank-name folders, blank-title/unsafe-url bookmarks, and bad icons.
- [x] 3.3 Accumulate and return a result summary (folders created, bookmarks created, entries skipped); surface a structural-error result for non-uTab files.
- [x] 3.4 Inject or mock chrome/icon dependencies so the importer is unit-testable off a real browser.

## 4. Unit tests for the importer
- [x] 4.1 Happy path: sample-shaped export creates the expected subfolders/bookmarks with icons attached.
- [x] 4.2 Skip-and-report: blank folder name, blank bookmark title, and unsafe url are skipped and counted; valid siblings still import.
- [x] 4.3 Icon fallback: missing/undecodable/oversized `preview` skips the icon but keeps the folder/bookmark.
- [x] 4.4 Structural rejection: non-JSON and JSON-without-`folders` create nothing and report an error.
- [x] 4.5 No de-dup: importing the same export twice creates two sets.

## 5. Folder Settings UI
- [x] 5.1 Add the "Import Bookmarks" dropdown (single "Import uTab" item) and a hidden `<input type="file" accept=".json,application/json">` to `FolderSettingsWindow.tsx`, targeting `folder.id`.
- [x] 5.2 Wire selection → file read → `utab` import → show the result summary or error line in the window; guard against double-invocation while a run is in flight.
- [x] 5.3 Style the dropdown and result/summary line in `main.css` to match the settings-window look.
- [x] 5.4 Component tests: dropdown renders "Import uTab"; choosing a file invokes the importer with the folder id; a returned summary/error is rendered.
- [x] 5.5 Change style of the dropdown by aligning it to the right. Also increase height of settings window by 20px so dropdown menu items do not overlap other components (buttons) of the window.

## 6. Verification
- [x] 6.1 Add/extend a Playwright e2e that imports the sample `design/examples/uTab.json` from a folder's settings window and asserts the subfolders/bookmarks (and at least one custom icon) appear on the sidebar/canvas.
- [x] 6.2 Run typecheck, lint, unit, and e2e green.
- [x] 6.3 `openspec validate import-utab-bookmarks --strict` passes.
