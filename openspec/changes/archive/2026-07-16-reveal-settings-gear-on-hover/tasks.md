# Tasks

## 1. Bookmark cell gear

- [x] 1.1 In `src/newtab/main.css`, hide `.bookmark-icon-settings-toggle` at rest via `opacity: 0` (keep it in the DOM and clickable; do not use `display: none`).
- [x] 1.2 Reveal it on cell hover: `.grid-cell--occupied:hover .bookmark-icon-settings-toggle { opacity: 1; }`.
- [x] 1.3 Reveal it on keyboard focus: `.bookmark-icon-settings-toggle:focus-visible { opacity: 1; }`.
- [x] 1.4 Optionally add a short `transition: opacity` for a subtle fade; verify no layout shift of the icon/label.

## 2. Folder row gear

- [x] 2.1 In `src/newtab/main.css`, hide `.folder-settings-toggle` at rest via `opacity: 0` (keep it in the DOM and clickable).
- [x] 2.2 Reveal it on row hover: `.folder-row:hover .folder-settings-toggle { opacity: 1; }`.
- [x] 2.3 Reveal it on keyboard focus and while its settings window is open: `.folder-settings-toggle:focus-visible`, and keep it visible when the folder's settings window is open (row/toggle in the open state).
- [x] 2.4 Confirm root folders are unaffected (they render no toggle) and the row layout does not shift as the gear appears/disappears.

## 3. Verify

- [x] 3.1 Run existing unit tests (`BookmarkIcon`, `FolderTreeNode`) — the gear stays in the DOM and clickable, so they should pass.
- [x] 3.2 Manually verify in the extension new tab: gear hidden at rest, visible on hover of cell/row, visible on Tab focus, click still opens the correct window.
