## 1. Storage: generalSettings object + background bytes

- [x] 1.1 Add a `GeneralSettings` interface to `src/lib/storage/schema.ts` with a `background: { kind: "none" } | { kind: "upload"; fit: "cover" | "contain" | "center" }` field; add a `generalSettings` key to `StorageSchema` and `STORAGE_KEYS`
- [x] 1.2 Add `src/lib/storage/generalSettings.ts` with `getGeneralSettings()` (returns a default `{ background: { kind: "none" } }` when unset) and `setGeneralSettings()` / a focused `setBackground()` writer
- [x] 1.3 Add a reserved IndexedDB key constant `CANVAS_BACKGROUND_KEY = "__canvas_background__"` (e.g. in `src/lib/storage/canvasBackground.ts`), reusing `iconDb` `putIcon`/`getIcon`/`deleteIcon` for the bytes
- [x] 1.4 Unit tests for `generalSettings` read/write defaults and the reserved-key put/get/delete round-trip

## 2. Background upload validation (10 MB)

- [x] 2.1 Add `MAX_BACKGROUND_FILE_SIZE_BYTES = 10_000_000` and `validateBackgroundFile(file)` to `src/lib/icons/validation.ts`, reusing `sniffIconFormat` + the decode check, differing only in the size cap
- [x] 2.2 Unit tests: accepts png/jpeg/webp/avif ≤10 MB, rejects SVG/unknown, rejects >10 MB, rejects undecodable-but-matching-header

## 3. Sidebar header + hamburger button

- [x] 3.1 In `Sidebar.tsx`, add a `.sidebar-header` element above `.sidebar-scroll-area` containing a hamburger (☰) button with an accessible label (e.g. "Open settings")
- [x] 3.2 Add `openGeneralSettings` boolean state in `Sidebar` (or lift to `App` if cleaner); the hamburger toggles it open — lifted to `App` so the window and canvas share one background source
- [x] 3.3 Add `.sidebar-header` / hamburger CSS in `main.css`: fixed above the scroll area, button pinned top-right, matching the sidebar's visual style
- [x] 3.4 Verify the header stays fixed while the folder tree scrolls, and is not a folder row (no name/icon/expand, not selectable/draggable)

## 4. GeneralSettingsWindow (cloned modal)

- [x] 4.1 Create `src/newtab/components/GeneralSettingsWindow.tsx` by cloning `FolderSettingsWindow`'s modal shell: portal to `document.body`, backdrop, titlebar with title "Settings" + close ✕, Escape-to-close, footer with Save; use `general-settings-window-*` classes
- [x] 4.2 Implement the Background control: preview box (staged image via object URL, or a "no background" placeholder), "Upload image" button (accept png/jpeg/webp/avif → `validateBackgroundFile`), "Remove image" button when a background is set
- [x] 4.3 Implement the fit control (cover / contain / center radio group), seeded from saved fit, default cover; relevant only when a background is set
- [x] 4.4 Stage edits with a `PendingBackground` union (`unchanged` | `upload` | `removed`) + separate fit state; revoke the staged upload's object URL on unmount
- [x] 4.5 On Save: apply upload (`putCanvasBackground`) or removal (`deleteCanvasBackground`), then write `generalSettings.background` (`{ kind: "upload", fit }` or `{ kind: "none" }`); then close. Close/Escape/backdrop discard staged edits
- [x] 4.6 Clone the needed `general-settings-window-*` CSS in `main.css` from the `folder-settings-window-*` rules
- [x] 4.7 Render `GeneralSettingsWindow` from `Sidebar` (or `App`) when the open state is true — rendered from `App`

## 5. Apply background to the canvas

- [x] 5.1 Add a `useCanvasBackground` hook: read `generalSettings`; when `kind: "upload"`, load the blob from `CANVAS_BACKGROUND_KEY`, create an object URL, and return the `background-image` + `background-size`/`background-position` (per fit) + `background-repeat: no-repeat` style; own object-URL create/revoke on change and unmount
- [x] 5.2 Subscribe the hook to `onStorageKeysChanged(["generalSettings"], …)` so background changes re-read and re-apply live across open tabs
- [x] 5.3 Apply the returned style to the `.canvas` element in `Canvas.tsx`; render no background image when `kind: "none"`
- [x] 5.4 Verify the background covers the canvas area only, not the sidebar or the full window

## 6. Verification

- [x] 6.1 Verify: upload → Save applies to canvas; remove → Save clears it and deletes the stored bytes — covered by `e2e/general-settings-window.spec.ts` (real extension: canvas `background-image` is a blob URL sized `cover`, and clears to `none` after removal). Fit modes verified by unit test (`saves the chosen fit mode`) and the hook's `background-size` mapping
- [x] 6.2 Verify staging discard: close / Escape / backdrop each discard unsaved edits — Escape covered by e2e; close + backdrop discard covered by unit tests (`discards a staged upload when closed`, `closes on Escape without persisting`)
- [x] 6.3 Verify live sync: the hook subscribes via `onStorageKeysChanged(["generalSettings"])`, the same profile-wide propagation mechanism already e2e-covered by `multi-tab-sync.spec.ts`; a background change re-reads and re-applies the same way
- [x] 6.4 Add/adjust component tests (`GeneralSettingsWindow`) covering open/close, staged-then-discard, Save, fit, and oversized-file rejection paths
- [x] 6.5 Run lint, typecheck, unit tests, and build
