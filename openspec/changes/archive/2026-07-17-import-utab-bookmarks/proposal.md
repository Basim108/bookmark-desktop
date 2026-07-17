## Why

Users migrating from the uTab new-tab extension have an existing library of
folders and bookmarks (each with a custom icon) exported as a JSON file, but no
way to bring them into this extension short of recreating everything by hand.
This change adds a one-click importer that reads a uTab JSON export and
recreates its folders and bookmarks — icons included — inside a folder the user
picks. It is also the extension's first bookmark-*creation* path: until now the
extension only reads, edits, moves, and removes Chrome's existing bookmarks.

## What Changes

- Add an **"Import Bookmarks"** dropdown control to the Folder Settings window
  (`FolderSettingsWindow`). For now it has a single item, **"Import uTab"**.
- Selecting "Import uTab" opens the OS file picker (`<input type="file"
  accept=".json,application/json">`) for the user to choose a uTab export from
  their local machine. Nothing is uploaded off-device; the file is read locally.
- Parse the file as a uTab export: an object with a `folders` array. Each folder
  has `name`, an optional `preview` (a base64 image data URL for its icon), and
  a `bookmarks` array. Each bookmark has `title`, `url`, and an optional
  `preview` (base64 icon data URL).
- Recreate the structure **inside the folder whose settings window is open**:
  for each uTab folder, create a Chrome subfolder (parented to the selected
  folder) carrying its `name` and, if the `preview` decodes and validates,
  its custom icon; then create each of its bookmarks as a Chrome bookmark inside
  that subfolder, with its `title`, `url`, and (if valid) custom icon.
- Icons: a `preview` data URL is decoded to a Blob, run through the existing
  icon validation pipeline (magic-byte format sniff + decode check + 1 MB cap),
  and stored via `putIcon` keyed by the newly created node's id, with the
  node's `hasCustomIcon` flag set. An absent, malformed, or oversized `preview`
  is skipped — the folder/bookmark still imports and falls back to the default
  folder icon / favicon.
- URLs are gated by the existing `isSafeNavigationUrl` allowlist before a
  bookmark is created, the same guard that protects click-navigation and
  editing (blocks `javascript:`, `data:`, etc.).
- **Skip & report** on bad entries: entries with an empty title or an unsafe
  URL are skipped rather than aborting the whole import; a bad icon just falls
  back without dropping its bookmark. When the import finishes, the window shows
  a summary (e.g. "Imported 3 folders, 24 bookmarks — skipped 2"). A file that
  is not valid JSON or not shaped like a uTab export fails the whole import with
  a clear error and creates nothing.
- **No de-duplication (v1):** every import creates fresh folders/bookmarks even
  if identical ones already exist. Re-importing the same file produces
  duplicates; the user manages that manually.
- Newly created bookmarks are positioned automatically by the existing
  background `onCreated` listener (next free grid cell, in creation order), so
  this change does not write to the positions store directly.

## Capabilities

### New Capabilities
- `bookmark-import`: importing external bookmark exports into a selected folder,
  starting with the uTab JSON format — parsing, structure mapping (folder →
  subfolder, bookmark → bookmark), icon decoding/validation, URL safety gating,
  and skip-and-report handling of invalid entries.

### Modified Capabilities
- `folder-sidebar`: the Folder Settings window gains an "Import Bookmarks"
  dropdown (single "Import uTab" item) that launches the importer targeting that
  folder.

## Impact

- Affected code:
  - `src/newtab/components/FolderSettingsWindow.tsx` — add the "Import
    Bookmarks" dropdown, hidden JSON file input, import progress/result summary
    state, and wiring to the importer targeting `folder.id`.
  - `src/lib/bookmarks/create.ts` (new) — first `chrome.bookmarks.create`
    wrappers: `createFolder(parentId, title)` and `createBookmark(parentId,
    title, url)`, with title-trim/non-empty and `isSafeNavigationUrl` gating,
    returning the created node (its id is needed to attach an icon).
  - `src/lib/import/utab.ts` (new) — parse + validate the uTab JSON shape and
    drive the import: create subfolders/bookmarks, decode/validate/store icons,
    accumulate a skip-and-report result. Pure-ish and unit-testable, with
    chrome/icon dependencies injected or mocked.
  - `src/lib/import/dataUrl.ts` (new, or a helper in `utab.ts`) — decode a
    base64 image data URL to a Blob for the validation/`putIcon` pipeline.
  - `src/lib/icons/validation.ts` — allow the shared validator to accept a
    `Blob` (not only a `File`) so a decoded data-URL Blob can reuse
    `validateIconFile`'s format/size/decode checks.
  - `src/lib/storage/folderSettings.ts` / `bookmarkSettings.ts` — reuse existing
    `setFolderHasCustomIcon` / the bookmark equivalent to flag imported items
    that got a custom icon.
  - `src/newtab/main.css` — styles for the "Import Bookmarks" dropdown and the
    import result/summary line, matching the settings-window look.
- No new storage keys. Imported icons live in IndexedDB alongside existing
  icons, keyed by the new nodes' Chrome bookmark ids. No schema migration.
- No new dependencies and no new manifest permissions — `chrome.bookmarks`
  (already held) covers creation; the file is read locally via the File API.
- New write path: this is the first place the extension calls
  `chrome.bookmarks.create`. A bulk import fires one `onCreated` placement write
  per bookmark (Chrome's native `onImportBegan/Ended` batching does not apply to
  programmatic creation); acceptable at typical export sizes, noted in design.
