## 1. Project & Extension Setup

- [x] 1.1 Scaffold Manifest V3 extension project (TypeScript, Vite + `@crxjs/vite-plugin`)
- [x] 1.2 Configure manifest: new-tab override, `bookmarks`/`storage`/`favicon` permissions only
- [x] 1.3 Set up ESLint + Prettier with pre-commit hooks (Husky + lint-staged)
- [x] 1.4 Set up Vitest for unit tests and Playwright for e2e (unpacked-extension launch)
- [x] 1.5 Set up CI pipeline (typecheck, lint, unit, e2e) gating merges

## 2. Bookmark Data Layer

- [x] 2.1 Implement `chrome.bookmarks` read layer (folder tree, per-folder children)
- [x] 2.2 Define extension storage schema: `chrome.storage.local` for positions/settings, IndexedDB for custom icon bytes
- [x] 2.3 Implement first-run bulk seed: walk each folder's Chrome-order bookmarks into next-free-cells
- [x] 2.4 Implement next-free-cell placement (new bookmark created, moved into folder, moved back to a prior folder)
- [x] 2.5 Wire `chrome.bookmarks.onCreated/onRemoved/onMoved/onChanged` listeners; ignore same-parent reorder events

## 3. Sidebar & Folder Tree

- [x] 3.1 Build sidebar folder tree component (Chrome's native folder order)
- [x] 3.2 Implement folder selection → active-folder state driving canvas filtering
- [x] 3.3 Implement per-folder sidebar display setting (icon/label/both), independent, no inheritance
- [x] 3.4 Disable icon display option until folder has a custom uploaded image
- [x] 3.5 Validate folder name (reject empty/whitespace-only)

## 4. Canvas Grid & Pagination

- [x] 4.1 Build canvas grid component rendering current folder's bookmark icons
- [x] 4.2 Implement grid-settings resolution chain (folder → nearest ancestor → global default)
- [x] 4.3 Implement auto-mode sizing formula (icon scaling below max size, column/row growth at max size)
- [x] 4.4 Implement fixed-mode sizing (locked rows×cols, icon-only scaling, scrollable floor below min size)
- [x] 4.5 Implement column-growth backfill (pull items forward from later pages, cascading)
- [x] 4.6 Implement row-growth empty-cell behavior (no backfill)
- [x] 4.7 Implement shrink compaction (fill same-page empty cells first) and cascade push to next page
- [x] 4.8 Implement pagination UI (page indicator/navigation)

## 5. Position Model & Drag Interactions

- [x] 5.1 Implement drag-and-drop repositioning within canvas (updates stored position)
- [x] 5.2 Implement swap-on-drop-to-occupied-cell
- [x] 5.3 Implement drag-to-edge auto-advance pagination
- [x] 5.4 Implement pinned-position overflow-page handling (resume exact position when grid regains capacity)
- [x] 5.5 Implement click-to-navigate on bookmark icon (already covered by Group 4's BookmarkIcon)

## 6. Cross-Folder Drag

- [ ] 6.1 Implement drag bookmark icon → drop on sidebar folder row → `chrome.bookmarks.move` + next-free-cell placement in destination
- [ ] 6.2 Implement drag folder row → drop on another folder row (sidebar-only) → `chrome.bookmarks.move`, preserving nested items' stored positions

## 7. Icon Assets

- [ ] 7.1 Implement favicon retrieval via MV3 `_favicon` API
- [ ] 7.2 Implement custom icon upload UI (PNG/JPEG/WebP/AVIF only, reject SVG)
- [ ] 7.3 Implement magic-byte file-type validation on upload
- [ ] 7.4 Implement max file size / max pixel dimension enforcement on upload
- [ ] 7.5 Store uploaded image bytes in IndexedDB; store reference/metadata in `chrome.storage.local`
- [ ] 7.6 Implement custom icon removal (revert to favicon)
- [ ] 7.7 Implement generic fallback icon (favicon unresolvable and no custom icon) — placeholder asset until final asset is supplied
- [ ] 7.8 Ensure all icon rendering uses `<img>`/blob URL, never inline-parsed markup

## 8. Label Display Settings

- [ ] 8.1 Implement per-bookmark label display setting (under-icon vs. tooltip), default visible, no inheritance

## 9. Live Cross-Tab Sync

- [ ] 9.1 Propagate layout/settings changes across open tabs via `chrome.storage.onChanged`
- [ ] 9.2 Propagate bookmark/folder structure changes across open tabs via `chrome.bookmarks` events

## 10. Testing

- [ ] 10.1 Unit tests: grid sizing formula, backfill/compaction logic, next-free-cell placement, inheritance chain resolution
- [ ] 10.2 Unit tests: icon upload validation (magic bytes, size/dimension limits, SVG rejection)
- [ ] 10.3 E2E: drag-and-drop reposition persists across reload
- [ ] 10.4 E2E: folder selection filters canvas correctly
- [ ] 10.5 E2E: bookmark click navigation
- [ ] 10.6 E2E: favicon fallback and custom icon upload/removal
- [ ] 10.7 E2E: multi-tab live sync (layout and structure changes)
- [ ] 10.8 E2E: cross-folder drag (bookmark→folder, folder→folder)

## 11. Pre-Publish Security Scan

- [ ] 11.1 Build the packaged `.crx` for scanning
- [ ] 11.2 Run Tarnish against the packaged `.crx` (dangerous-function/CSP/vulnerable-library scan); resolve findings
- [ ] 11.3 Run ThreatXtension against the extension code; resolve findings
- [ ] 11.4 Repeat 11.1–11.3 before each Chrome Web Store submission (manual/scheduled, not part of per-PR CI)
