## Why

Chrome's native new-tab page and bookmark manager give no visual, spatial way to browse bookmarks — just flat lists. This change turns the new-tab page into a literal "desktop" of bookmark icons the user can arrange, organize into folders via a sidebar, and click to navigate, closer to how people already organize files on a real desktop.

## What Changes

- New-tab override page rendering a bookmark "desktop": bookmarks as icons on an invisible, paginated grid; clicking an icon navigates to its URL.
- Icon positions persist per folder (page/row/col), survive resize, browser restarts, and stay live-synced across all open new-tab pages.
- Two grid modes per folder (auto-sizing formula vs. user-fixed rows×cols), inherited down the folder tree with a global default fallback.
- Drag interactions: reposition icons (swap on drop-onto-occupied-cell), edge-drag pagination, drag a bookmark onto a sidebar folder to move it (via `chrome.bookmarks.move`).
- Sidebar folder tree (Chrome's native folder order) for folder selection/filtering and folder-to-folder drag nesting; folders never appear on the canvas.
- Per-folder sidebar display setting (icon/label/both), independent per folder, gated on the folder having a custom uploaded image.
- Bookmark icon assets: favicon by default, optional custom image upload (PNG/JPEG/WebP/AVIF only), removable back to favicon, generic fallback if no favicon resolves.
- Per-bookmark label display setting (under-icon vs. tooltip), independent per bookmark, default visible.

## Capabilities

### New Capabilities
- `bookmark-canvas`: the new-tab grid/pagination system — layout modes, resize behavior, position/order persistence rules, in-canvas drag interactions (swap, edge-paging), click-to-navigate, per-bookmark label display, and live sync of layout across open tabs.
- `folder-sidebar`: the folder tree sidebar — Chrome-order display, folder selection filtering the canvas, per-folder sidebar display settings (icon/label/both + validation), folder-to-folder drag nesting, and bookmark-to-folder drag moves.
- `bookmark-icons`: bookmark icon asset resolution — default favicon retrieval, custom image upload/removal, format restrictions, and upload security validation (file-type sniffing, size/dimension caps, safe rendering).

### Modified Capabilities
_None — greenfield project, no existing specs._

## Impact

- New Chrome Manifest V3 extension codebase (new-tab override page + background service worker).
- New permissions: `bookmarks`, `storage`, `favicon`.
- New build/test tooling per `openspec/project.md`: TypeScript, Vite + `@crxjs/vite-plugin`, a UI framework + drag-and-drop library, Vitest, Playwright e2e, ESLint/Prettier, CI pipeline.
- New local storage: `chrome.storage.local` for layout/settings, likely IndexedDB for custom icon image bytes.
