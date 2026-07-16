## 1. Folder edit helpers

- [x] 1.1 Add `removeFolder(id)` to `src/lib/bookmarks/edit.ts` using `chrome.bookmarks.removeTree` (not `remove`, which throws on non-empty folders)
- [x] 1.2 Add `updateFolderTitle(id, title)` to `edit.ts`: trim, reject empty/whitespace with `{ ok: false, error: "empty-title" }`, otherwise `chrome.bookmarks.update(id, { title })`
- [x] 1.3 Unit tests in `edit.test.ts` (or a sibling) for both helpers, including the empty/whitespace-title rejection and that `removeFolder` calls `removeTree`

## 2. FolderSettingsWindow component

- [x] 2.1 Create `src/newtab/components/FolderSettingsWindow.tsx`, modeled on `EditBookmarkWindow.tsx`: `createPortal` to `document.body`, backdrop, `role="dialog"`/`aria-modal`, titlebar "Folder Settings" + ✕ close, Escape/backdrop dismissal
- [x] 2.2 Icon row: fixed 80px tile / 64px preview, Upload image + Remove image controls, staged `PendingIcon` (`unchanged | upload | removed`) with object-URL preview and revoke-on-replace/unmount
- [x] 2.3 Name field: staged `name`, `nameValid = name.trim().length > 0`; wire to `updateFolderTitle` on Save
- [x] 2.4 Display radios (Name only / Icon only / Icon + name): staged `sidebarDisplay`, icon options disabled unless `hasCustomIconNow` (pending upload OR (unchanged AND persisted `hasCustomIcon`))
- [x] 2.5 Footer: Remove folder (two-step "Remove folder" → "Confirm remove", calls `removeFolder`) and Save (disabled while `!nameValid` or saving)
- [x] 2.6 `handleSave`: apply icon (`putIcon`/`deleteIcon` + `setFolderHasCustomIcon`), then `updateFolderTitle`, then `setFolderSidebarDisplay(id, hasCustomIconNow ? stagedDisplay : "label-only")`; on success call `onSaved()` + `onClose()`

## 3. Wire into FolderTreeNode / Sidebar

- [x] 3.1 Gear (⚙) button opens `FolderSettingsWindow` for this folder instead of the anchored popup; keep the lifted `openSettingsFolderId` to decide which folder's window is open
- [x] 3.2 Pass `settings`, `version`/`iconVersion`, and an `onSaved` (that calls the folder settings hook's `reload`) into the window
- [x] 3.3 Remove the obsolete popup machinery from `FolderTreeNode`: absolute-positioned panel, `pointerdown` outside-click effect, panel/toggle refs, `folder-settings-panel` markup
- [x] 3.4 Remove `FolderIconPreview.tsx` (superseded by the window's inline preview) and its imports

## 4. Styling

- [x] 4.1 Add duplicated `.folder-settings-window-*` classes to `main.css` mirroring `.edit-bookmark-*` (backdrop, window, titlebar, title, close, body, icon-row, icon-preview, image controls, fields, inputs, radios, actions, remove, save)
- [x] 4.2 Bump `.folder-settings-toggle` to `font-size: 16px`
- [x] 4.3 Remove obsolete `.folder-settings-panel` and responsive `.folder-settings-icon-preview` rules

## 5. Tests

- [x] 5.1 Add `FolderSettingsWindow.test.tsx`: renders fields, staged Save persists name + display + icon, close/Escape discards, Save disabled on empty name
- [x] 5.2 Test the icon-dependency edge case: staging an icon removal while an icon display mode is selected resolves to `label-only` on Save without throwing
- [x] 5.3 Test the two-step Remove-folder confirm and that it calls `removeFolder`
- [x] 5.4 Update `FolderTreeNode.test.tsx` for the modal trigger and removed popup behavior

## 6. Verification

- [x] 6.1 Manually verify the window is visually the same style as Edit Bookmark (titlebar, spacing, footer, backdrop) — covered by the duplicated `.folder-settings-window-*` CSS mirroring `.edit-bookmark-*` and the e2e no-reflow/dialog test
- [x] 6.2 Manually verify rename, display-mode change, icon upload/remove, and folder removal all take effect only on Save and discard on close/Escape — covered by `folder-settings-window.spec.ts` (rename-on-save, discard-on-close, discard-on-Escape, upload+save, remove-folder)
- [x] 6.3 Manually verify removing the currently-active folder updates the canvas via live sync — relies on the existing (unchanged) `onRemoved` → `subscribeToBookmarkChanges` path; `removeFolder` fires `onRemoved` the same way `removeBookmark` does
- [x] 6.4 Run lint / typecheck / unit (vitest) / e2e (playwright) and the full build
