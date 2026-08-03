## 1. Generalise the import flow

- [x] 1.1 Rename `src/newtab/hooks/useRootFolderImport.ts` to reflect that it is no longer root-specific (e.g. `useUtabImport`), along with its `RootImportState` / `RootFolderImport` types. Both entry points now use it.
- [x] 1.2 Remove the `confirming` state and the `cancelConfirm` / `confirmAndPickFile` pair. Replace with a single `startImport(folder)` that records the destination and opens the picker in the same synchronous call.
- [x] 1.3 Carry the destination folder's **title** into the `running` state so the toast can name it — the id alone is not enough, and the root row's toast is rendered from Sidebar, not from the row that started the import.
- [x] 1.4 Keep `busy` covering both `picking` and `running` — a second import must not be startable while the OS dialog is open.

## 2. Delete the confirmation

- [x] 2.1 Delete `src/newtab/components/ImportConfirmWindow.tsx`.
- [x] 2.2 Remove its rendering from `Sidebar.tsx`; the root row button now reaches `startImport` directly.
- [x] 2.3 Remove the confirmation CSS (`.import-confirm-window`, `.import-confirm-text`, `.import-confirm-target`) from `main.css`.

## 3. Toast names the destination

- [x] 3.1 `ImportToast` renders the destination name in the running state — `Importing into <name>… 12 / 250`.
- [x] 3.2 Keep the existing behaviour of omitting the count until the first progress callback lands, so the toast never flashes `0 / 0`.
- [x] 3.3 The destination name is for the toast only. A settings-window import needs no such label — the window it reports in already identifies the folder.

## 4. Settings window drives the shared flow, keeps its own surface

- [x] 4.1 `FolderSettingsWindow` keeps its `Import Bookmarks ▾` menu, its hidden `<input>`, and its own click handler — the picker must open synchronously from its own gesture, so nothing is routed through a prop chain or an effect.
- [x] 4.2 Replace its ad-hoc `importing` / `importResult` state with the shared hook, so it inherits the progress callback, the report download, the summary formatting, and the `beforeunload` guard it has never had. The hook owns no rendering.
- [x] 4.3 Render progress in place: `Spinner` + the determinate count, replacing the bare `Importing…` text.
- [x] 4.4 Render the outcome in place and leave it there — the window does not close when the import ends, and the message is not removed on a timer.
- [x] 4.5 Disable the import menu item while an import is running, matching the root buttons.
- [x] 4.6 Resolved: `onSaved` was redundant after an import and is no longer called there. It reloads the folder's *own* settings, which an import never changes — it only creates children — and `forceBookmarkResync()` in the shared flow already refreshes those. `onSaved` now fires only on Save.

## 5. Block dismissal while an import runs

- [x] 5.1 Gate all **three** dismissal routes — Escape, the close control, and the backdrop — on the import being in flight. Guarding Escape alone leaves two ways to reproduce finding #7; follow `GeneralSettingsWindow`'s `dismissable = !overlay && !busy` shape (`:291`) rather than inventing a new one.
- [x] 5.2 Restore dismissal as soon as the import settles, on both the success and failure paths, so a finished import can never trap the user in a window they cannot close.
- [x] 5.3 The window's `try`/`finally` around the import is now load-bearing for dismissal, not just for the message: a promise that never settles would leave the window permanently unclosable. Verify every exit path resolves.
- [x] 5.4 This is the finding #7 fix the pre-publication report prescribed verbatim ("Add `if (busy) return;` alongside the existing guards"). Reference the finding in a comment so the guard is not later mistaken for defensive clutter.

## 6. Tests

- [x] 6.1 Remove the confirmation tests from `SidebarRootImport.test.tsx` and `e2e/import-utab.spec.ts`. Replace with: clicking a root row's import button opens the picker directly and shows no dialog.
- [x] 6.2 The settings window shows a spinner and an advancing count during an import.
- [x] 6.3 The window stays open when the import finishes and shows the outcome including the report filename.
- [x] 6.4 Escape, the close control, and the backdrop are each individually inert while an import runs — one test per route, since a single combined assertion would pass with two of the three still broken.
- [x] 6.5 The window is dismissable again once the import settles, including after a failed import.
- [x] 6.6 The `beforeunload` guard is registered for a settings-window import and released when it settles.
- [x] 6.7 E2E: the full settings-window path end to end, since the synchronous-gesture requirement (4.1) is only observable with a real file dialog.

## 7. Verification

- [x] 7.1 `npm run typecheck && npm run lint && npm run format`
- [x] 7.2 `npm test`
- [x] 7.3 `npm run test:e2e`
- [x] 7.4 Confirm both entry points report the same information — activity indicator and determinate count — even though they render it in different places.
- [x] 7.5 Confirmed: `GeneralSettingsWindow` is untouched. Its own `dismissable`/`busy` guards were the template followed here, not modified.

## 8. Follow-ups (not this change)

- [ ] 8.1 `focus-name-on-settings-window-open` also edits `FolderSettingsWindow.tsx`. Whichever change lands second wants a re-read of that file rather than a blind merge.
- [ ] 8.2 Dismissing the toast leaves no route back to the import summary. Pre-existing on the root path and now asymmetric with the settings window, which keeps its outcome until the user closes it. Acceptable — the root path has no window to hold it — but worth revisiting if it bites.
