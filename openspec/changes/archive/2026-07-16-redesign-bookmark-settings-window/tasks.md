## 1. Bookmark edit primitives

- [x] 1.1 Add `src/lib/bookmarks/edit.ts` with `updateBookmark(id, { title, url })` (wrapping `chrome.bookmarks.update`) and `removeBookmark(id)` (wrapping `chrome.bookmarks.remove`), rejecting empty/whitespace-only titles and URLs whose scheme is not on the `isSafeNavigationUrl` allowlist before calling Chrome.
- [x] 1.2 Add `src/lib/bookmarks/edit.test.ts` covering: valid title/url update, empty/whitespace title rejected, unsafe-scheme url rejected, and removal delegating to `chrome.bookmarks.remove`. (Also extended `src/test/chromeMock.ts` with `bookmarks.update`/`remove`.)

## 2. Edit Bookmark window component

- [x] 2.1 Add `src/newtab/components/EditBookmarkWindow.tsx` rendered via `createPortal` to `document.body` when open: fixed full-viewport backdrop + centered opaque panel; props for the bookmark, current settings, and an `onClose` callback.
- [x] 2.2 Title bar: "Edit Bookmark" left, a 16px close (✕) button right (`aria-label="Close"`).
- [x] 2.3 Icon preview (80px): show the staged image object URL if one is selected, else the existing custom icon (`CustomIconImage`), else the favicon (`FaviconImage`)/fallback — mirroring `BookmarkIcon`'s resolution order.
- [x] 2.4 Image controls: a short static helper line (no "(How?)" link) plus a green "Upload image" button that validates the picked file with `validateIconFile` and, on success, stages it in memory (`URL.createObjectURL`) without writing to IndexedDB; surface validation errors inline via `ICON_ERROR_MESSAGES`. Show a "Remove image" **button** only when the bookmark currently has a custom icon; clicking it stages a removal.
- [x] 2.5 Name field (editable, pre-filled from `bookmark.title`) and URL field (editable, pre-filled from `bookmark.url`), each with the label column on the left; validate the URL on change and show an inline error + disable Save when invalid or the name is empty/whitespace.
- [x] 2.6 Label-visibility checkbox ("Show label under icon"): checked ⇒ `under-icon`, unchecked ⇒ `tooltip`, initialized from current settings, staged locally.
- [x] 2.7 Bottom row: "Remove" (left) and "Save" (right); no Cancel.
- [x] 2.8 Save handler applies staged edits in order — icon (`putIcon`+`setBookmarkHasCustomIcon(true)` / `deleteIcon`+`setBookmarkHasCustomIcon(false)`), then `updateBookmark(id, { title, url })`, then `setBookmarkLabelDisplay` — then revokes any object URL and calls `onClose`.
- [x] 2.9 Remove handler shows a confirmation step; on confirm, calls `removeBookmark(id)` then `onClose` (the `events.ts` `onRemoved` cascade handles position/settings/icon cleanup; canvas/sidebar refresh via `subscribeToBookmarkChanges`).
- [x] 2.10 Close paths — ✕ button, backdrop click, and Escape key — revoke any object URL (via effect cleanup on unmount), discard staged state, and call `onClose` without persisting anything.

## 3. Wire into BookmarkIcon

- [x] 3.1 In `src/newtab/components/BookmarkIcon.tsx`, remove the inline `bookmark-icon-settings-panel` block (label radios + `IconUploadControls`) and the `LABEL_DISPLAY_OPTIONS`/panel wiring; keep reading `settings` for the icon/label render (incl. `tooltipOnly`).
- [x] 3.2 Repoint the `⚙` `bookmark-icon-settings-toggle` (aria-label now `Edit <title>`) to open `EditBookmarkWindow` (rendered conditionally when `editing`); one window per icon.
- [x] 3.3 After Save/Remove, ensure the icon re-renders (window's `onSaved` calls the `useBookmarkSettings` `reload`, bumping version so `CustomIconImage` refetches; chrome.bookmarks events already refresh title/url).

## 4. Styling

- [x] 4.1 In `src/newtab/main.css`, add the centered-modal pattern: `.edit-bookmark-backdrop` (fixed, `inset: 0`, scrim, high z-index) and `.edit-bookmark-window` (centered, opaque, 440px wide, rounded), plus title-bar (48px), content-padding (20px), icon-preview (80px), field-row, and button-row rules matching the reference spacing.
- [x] 4.2 Style the green "Upload image" button (#2abe7d, matching the reference action button); style Save (blue #1a73e8) and Remove (secondary outline) in the bottom row.
- [x] 4.3 Bump `.bookmark-icon-settings-toggle` font-size to 16px (box widened to 20px so the glyph is not clipped).
- [x] 4.4 Remove the now-unused `.bookmark-icon-settings-panel` and `.bookmark-settings-option` rules. (`.icon-upload-*` kept — still used by folder settings via `IconUploadControls`.)

## 5. Tests and verification

- [x] 5.1 Add `src/newtab/components/EditBookmarkWindow.test.tsx` covering: opens pre-filled; staged name/url/label not applied until Save; Save commits all; close-button and Escape discard; invalid URL and empty name block Save; staged image previews without persisting; "Remove image" only shown with a custom icon; staged icon removal reverts on Save; confirmed Remove calls `removeBookmark` and closes. (9 tests.)
- [x] 5.2 Update `src/newtab/components/BookmarkIcon.test.tsx` for the removed inline panel and the new trigger (opens the Edit Bookmark dialog). `IconUploadControls.test.tsx` left unchanged — the control is still used by folder settings.
- [x] 5.3 Run `npm run typecheck`, `npm run lint`, and `npm test` — all clean (179/179 unit tests pass).
- [x] 5.4 Update `e2e/` coverage: rewrote `e2e/icon-assets.spec.ts` for the modal upload/remove-with-Save flow; added `e2e/edit-bookmark.spec.ts` (edit name+url and Save asserts canvas label + stored url; Remove with confirm asserts the bookmark is gone from canvas and `chrome.bookmarks`; close-without-save discards). All 6 affected e2e tests pass in real Chromium. (Pre-existing `cross-folder-drag.spec.ts:38` flake is unrelated — it fails identically on the un-modified baseline.)
- [x] 5.5 Verified in a real loaded extension (Playwright + Chromium): captured a screenshot of the open window — centered, opaque, title bar + 16px ✕, 80px icon preview, green "Upload image" (no "(How?)"), pre-filled Name/URL, "Show label under icon" checkbox, Remove/Save with no Cancel, "Remove image" hidden without a custom icon. Deferred-save/discard, confirmed removal, and label behavior are all exercised by the passing e2e suite.
- [ ] 5.6 Run `openspec validate --change redesign-bookmark-settings-window --strict` — NOT RUN: the `openspec` CLI is not installed in this environment. Run once available before archiving.
