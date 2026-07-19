## Why

A full pre-publication review of v1.0.0 (commit `a17a75d`, recorded in
`before-publish-report.md`) found the codebase in strong shape — every automated
check green, least-privilege manifest, no remote code or off-device traffic —
but produced 11 findings that stand between the current tree and a Chrome Web
Store submission. Two are hard submission blockers (no privacy policy, no
screenshots), three are data-integrity defects in the newest feature
(export/import of full extension state), and the rest are correctness, UX-copy,
and hygiene issues best cleared while the code is fresh.

The P1 defects all sit on the most destructive code path the extension has — a
replace-import that deletes the user's entire bookmark tree — and they should be
fixed before that feature meets real users' data.

## What Changes

**Submission blockers (P0)**

- Add a `PRIVACY.md` policy document, hosted at a stable URL, declaring that all
  data stays in the browser and nothing is transmitted off-device beyond the
  MV3 `_favicon` fetches.
- Add a reproducible screenshot-capture script built on the existing Playwright
  harness (which already drives the real unpacked extension in Chromium), and
  produce the required store assets: ≥1 screenshot at 1280×800, plus a 440×280
  promo tile.

**State-transfer data integrity (P1)**

- **Import no longer orphans the replaced tree's data.** Today `importState`
  deletes the old tree while the transfer lock suppresses the `onRemoved`
  cleanup cascade, and `setFolderPositions` only merges — so every restore
  permanently strands the previous tree's `positions`, `bookmarkSettings`,
  `folderSettings` and its custom-icon blobs (up to ~1 MB each). Import will
  reset those stores to exactly what the file wrote and sweep unreferenced icon
  records.
- **Global images from a backup are validated.** `restoreGlobalIcon` currently
  persists arbitrary bytes of any size as the canvas background or default
  folder icon; it will run the same validation the per-item icon path uses, and
  fall back to clearing on failure.
- **The transfer lock survives a service-worker restart.** The lock is currently
  in-memory in the MV3 worker; it moves to `chrome.storage.session` with a
  timestamp so a crashed importer cannot wedge it permanently.

**Correctness and UX (P2)**

- Stop advertising `file:` and `ftp:` in the URL-editor's validation message —
  FTP was removed from Chrome in v88 and `file:` navigation from the new-tab
  page is blocked without an explicit user grant, so both silently do nothing.
- Escape no longer closes the Settings window mid-import (which stranded the
  running import, producing a mystery download and no summary).
- Chunk the base64 encoder so exporting a large background image stops blocking
  the main thread for millions of iterations.

**Hygiene (P3)**

- Remove the dead `IconUploadControls` component and its test.
- Correct `package.json` and README metadata pointing at the wrong repo.
- Add `homepage_url` to the manifest.

No breaking changes. Findings 3 and 4 alter only import-side read and cleanup
behavior — **the export file format is unchanged, so there is no export-format
version bump.**

## Capabilities

### New Capabilities

None. All spec-level changes land in existing capabilities.

### Modified Capabilities

- `state-transfer`: *Replace-Strategy Restoration* gains a requirement that the
  import resets per-item stored data rather than merging over it; *Restore
  General Settings and Global Images* gains validation of the two global images;
  *Import Lock Suspends Bookmark-Sync Listeners* gains durability across a
  service-worker restart.
- `general-settings`: the Settings window's dismissal behavior is constrained so
  a running import cannot be dismissed out from under itself.
- `bookmark-editor`: *Bookmark URL Editing* validation copy no longer advertises
  schemes that do not work from the new-tab page.
- `extension-branding`: adds requirements for a published privacy policy, the
  store screenshot/promo assets and their reproducible capture, and a manifest
  `homepage_url`.

## Impact

**Code**

- `src/lib/transfer/importState.ts` — data reset after the create-before-delete
  pass; validation in `restoreGlobalIcon`.
- `src/lib/bookmarks/events.ts`, `src/lib/transfer/lock.ts` — durable,
  timestamped lock read from `chrome.storage.session`; listeners become async at
  their guard.
- `src/lib/import/dataUrl.ts` — chunked encoding. Must stay `FileReader`-free:
  the function is documented as working in both page and worker contexts.
- `src/lib/bookmarks/urlSafety.ts` and the edit-window copy — scheme list and
  message.
- `src/newtab/components/GeneralSettingsWindow.tsx` — `busy` guard on Escape.
- `src/newtab/components/IconUploadControls.tsx` (+ test) — deleted.
- `manifest.config.ts`, `package.json`, `README.md` — metadata.

**Storage**

- Adds a `chrome.storage.session` key for the transfer lock. No new manifest
  permission — the existing `storage` permission covers `storage.session`.
- Import becomes destructive toward *stored data for the replaced tree*, which
  is the intended correction; the icon sweep must preserve the reserved keys
  `__default_folder_icon__` and `__canvas_background__`.

**Tests**

- New unit coverage for the import data reset, the icon sweep's reserved-key
  handling, global-image validation rejection, lock persistence across a
  simulated worker restart, and chunked-encoder round-tripping at sizes above
  the chunk boundary.
- New Playwright script for screenshot capture (asset generation, not an
  assertion suite).

**Process (not code)**

- Developer Dashboard: privacy policy URL, data-use disclosures (no collection,
  no transfer), single-purpose description, permission justifications for
  `bookmarks` / `storage` / `favicon`, and the packed upload following
  `SECURITY.md`'s `.pem` handling.
