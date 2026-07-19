## 1. Storage reset primitives (prerequisite for finding 3)

- [x] 1.1 Add a whole-map replace to `src/lib/storage/positions.ts` that writes the given folder→positions map as the complete stored value, replacing rather than merging (contrast `setFolderPositions`)
- [x] 1.2 Add a whole-map replace to `src/lib/storage/bookmarkSettings.ts` that leaves the store holding exactly the given entries
- [x] 1.3 Add a whole-map replace to `src/lib/storage/folderSettings.ts` that leaves the store holding exactly the given entries
- [x] 1.4 Add a keep-set prune to `src/lib/storage/iconDb.ts` that deletes every icon record whose key is not in the given set, in a single IndexedDB transaction, and unconditionally exempts `__default_folder_icon__` and `__canvas_background__`
- [x] 1.5 Unit-test each new primitive, including that the icon prune preserves the two reserved keys even when they are absent from the keep-set

## 2. Import no longer orphans the replaced tree's data (finding 3)

- [x] 2.1 Extend the import accumulator in `src/lib/transfer/importState.ts` to record the ids it creates, the positions it writes, and the bookmark/folder settings it writes — the keep-set the sweep will prune to
- [x] 2.2 After the per-root create-before-delete pass and while the transfer lock is still held, apply the three whole-map replaces from the accumulated writes
- [x] 2.3 Prune the icon store to the created ids plus the reserved keys, in the same locked window
- [x] 2.4 Confirm the sweep runs only on the success path — never in the `finally` that releases the lock — so a partial failure cannot prune against an incomplete keep-set
- [x] 2.5 Test: importing over a tree with stored positions, settings, and custom icons leaves no entry keyed by a replaced-tree id
- [x] 2.6 Test: repeated successive imports produce the same stored state as importing once into a clean profile (no accumulation)
- [x] 2.7 Test the partial-failure paths flagged in design.md — a root unavailable in the target profile, and a root whose creation throws — and assert no live data for successfully created ids is pruned

## 3. Global images from a backup are validated (finding 4)

- [x] 3.1 In `restoreGlobalIcon` (`src/lib/transfer/importState.ts`), run `validateBackgroundFile` on the canvas background and `validateIconFile` on the default folder icon before persisting
- [x] 3.2 On validation failure, clear the corresponding global image and continue the import rather than aborting, mirroring the per-item icon path's swallow-and-fall-back
- [x] 3.3 Test: an oversized, undecodable, or wrong-format global image in the file is not persisted, the target image ends cleared, and the import still reports success

## 4. Transfer lock survives a service-worker restart (finding 5)

- [x] 4.1 Define the lock record — held flag plus taken-at timestamp — and a staleness bound sized against a worst-case large import, documenting the chosen value and its rationale
- [x] 4.2 Write the lock record to `chrome.storage.session` in `acquireTransferLock` and clear it in `releaseTransferLock` (`src/lib/transfer/lock.ts`), keeping the existing best-effort runtime message as the in-memory fast path
- [x] 4.3 Make the four listener guards in `src/lib/bookmarks/events.ts` consult the stored record, treating the in-memory flag as a fast path and the stored record as the authority
- [x] 4.4 Treat a record older than the staleness bound as not held, so a crashed importer cannot suspend synchronization permanently
- [x] 4.5 Test: with the in-memory flag reset to simulate a worker restart, the listeners still observe the lock as held for the rest of the import
- [x] 4.6 Test: a lock record older than the bound is ignored and the listeners resume normal synchronization
- [x] 4.7 Verify no manifest change is needed — the existing `storage` permission covers `storage.session`

## 5. Correctness and UX (findings 6, 7, 8)

- [x] 5.1 Remove `file:` and `ftp:` from `ALLOWED_NAVIGATION_SCHEMES` in `src/lib/bookmarks/urlSafety.ts` and update its docstring to record why
- [x] 5.2 Update the edit window's invalid-URL copy so it names only schemes that navigate successfully from the new-tab page
- [x] 5.3 Update existing urlSafety tests for the narrowed allowlist and add coverage that `file:`/`ftp:` are now rejected
- [x] 5.4 Add a `busy` guard to the keydown handler in `src/newtab/components/GeneralSettingsWindow.tsx` alongside the existing `summary`/`confirmOpen` guards, and apply the same guard to the close control and backdrop
- [x] 5.5 Test: Escape, the close control, and the backdrop all leave the window open while an import is running, and dismiss it normally once the summary is acknowledged
- [x] 5.6 Chunk the encoder in `src/lib/import/dataUrl.ts` using `String.fromCharCode(...bytes.subarray(i, i + 0x8000))` — do NOT switch to `FileReader`, which its docstring deliberately avoids for worker-context compatibility
- [x] 5.7 Test: round-trip `blobToDataUrl` → `dataUrlToBlob` at sizes spanning the chunk boundary (just under, exactly at, and several chunks over) with byte-identical results and preserved MIME type

## 6. Hygiene (findings 9, 10, 11)

- [x] 6.1 Delete `src/newtab/components/IconUploadControls.tsx` and its test, and confirm nothing else imports it
- [x] 6.2 Fix `package.json`: rename `web-desktop` → `bookmark-desktop` and repoint `homepage`, `bugs`, and `repository` at `Basim108/bookmark-desktop`
- [x] 6.3 Fix the README title `Bookmark Desktop (web-desktop)` and any other stale `web-desktop` references in docs
- [x] 6.4 Add `homepage_url` to `manifest.config.ts` pointing at the repository, and verify it appears in the built manifest

## 7. Privacy policy (finding 1 — P0 blocker)

- [x] 7.1 Write `PRIVACY.md`, adapting the privacy paragraph in `docs/store-listing.md`: what data is handled (bookmarks, positions, settings, uploaded images), that it all stays in browser-local storage on device, that nothing is transmitted off-device, and that the only outbound requests are the MV3 `_favicon` fetches
- [x] 7.2 Add a last-updated date and a contact route for privacy questions
- [x] 7.3 Cross-check every claim against the manifest's declared permissions (`bookmarks`, `storage`, `favicon`) and the extension's actual network behavior
- [ ] 7.4 Publish it at a stable public URL (GitHub Pages or the repo's rendered markdown) and record that URL in the change

## 8. Store visual assets (finding 2 — P0 blocker)

- [x] 8.1 Add a Playwright-based capture script that reuses the e2e extension-loading fixture but runs as its own npm-script entry point, separate from the assertion suite
- [x] 8.2 Have it seed representative bookmark content so screenshots show a populated desktop, never an empty or unconfigured state
- [x] 8.3 Capture at a 1280×800 viewport so the required dimensions come out of the run directly, with no manual cropping
- [x] 8.4 Produce at least one 1280×800 screenshot plus the 440×280 promo tile, and commit them under a documented assets path
- [x] 8.5 Document how to regenerate the assets after a UI change

## 9. Verification

- [x] 9.1 Run `npm run typecheck`, `npm run lint`, `npm test`, and `npx playwright test` — all green
- [x] 9.2 Run `npm run build` and confirm the built manifest carries `homepage_url` and the corrected metadata
- [x] 9.3 Automated in place of the manual pass: a new e2e test asserts no replaced-tree residue after a real import in Chromium (verified failing against the pre-fix importer); the Escape-during-import guard is covered by unit tests. A human spot-check in a real profile is still worth doing before submitting
- [x] 9.4 Confirm the export file format is byte-compatible with pre-change exports in both directions — no version bump

## 10. Dashboard submission (process, not code)

- [ ] 10.1 Set the privacy policy URL in the Developer Dashboard
- [x] 10.2 Drafted in `docs/store-submission.md` (every category "no" + the three certifications) — entering them in the dashboard is manual
- [x] 10.3 Drafted in `docs/store-submission.md`. Enter the single-purpose description from `docs/store-listing.md` (short description is 107 chars, within the 132 limit)
- [x] 10.4 Drafted in `docs/store-submission.md` — one-sentence justifications for `bookmarks`, `storage`, and `favicon`
- [ ] 10.5 Upload the packed build, following `SECURITY.md` for signing-key handling — move the `.pem` to a vault immediately after packing
- [x] 10.6 Both warnings documented in `docs/store-submission.md` and confirmed explained by the existing listing copy. Review the listing against the expected install warnings ("Replace the page you see when opening a new tab", "Read and change your bookmarks"), confirming the copy already explains both
