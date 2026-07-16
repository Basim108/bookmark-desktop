## Why

The extension has per-folder and per-bookmark settings, but no place for
settings that apply to the whole new-tab page. The first such setting is a
canvas background image: users want to replace the plain canvas with their own
image. This introduces a general "Settings" window — opened from the sidebar
rather than from any one folder or bookmark — as the home for global settings,
starting with the canvas background and structured so more global settings can
be added later.

## What Changes

- Add a header band at the top of the sidebar, outside the scrollable folder
  tree, containing a hamburger (☰, three horizontal lines) button pinned to the
  top-right corner. The button opens the General Settings window.
- Add a `GeneralSettingsWindow` — a centered modal window titled "Settings",
  styled to match the Folder Settings / Edit Bookmark windows (titlebar with a
  close ✕ in the top-right corner, opaque body, footer with a Save button). It
  clones the existing modal shell rather than extracting a shared component.
- Add one setting to the window for now: **Background**. The user can upload an
  image to use as the canvas background, remove it, and choose how it fits
  (cover / contain / center). Uploaded image bytes are stored in IndexedDB under
  a reserved key; the fit mode and whether a background exists are stored in
  chrome.storage.local under a new extensible `generalSettings` object.
- Apply the background image to the canvas only (the grid area), not the sidebar
  or the whole window. `background-size`/`background-position` follow the chosen
  fit mode; the default fit is cover.
- Edits in the window are staged and applied together only on Save; closing the
  window, pressing Escape, or clicking the backdrop discards unsaved edits.
- Background changes propagate live to every open new-tab page, like other
  settings, via chrome.storage.local change events.
- Uploaded background images are validated by format (png/jpeg/webp/avif, no
  SVG) via the existing magic-byte sniffing, but with a 10 MB size cap instead
  of the 1 MB cap used for icons.

## Capabilities

### New Capabilities
- `general-settings`: a global Settings window opened from a sidebar header
  button, and its first setting — a configurable canvas background image.

### Modified Capabilities
- `folder-sidebar`: the sidebar gains a header band, outside the scrollable
  folder tree, holding the hamburger button that opens the General Settings
  window.

## Impact

- Affected code:
  - `src/newtab/components/Sidebar.tsx` — new header band + hamburger button and
    open/close state for the settings window.
  - `src/newtab/components/GeneralSettingsWindow.tsx` (new) — the modal (cloned
    from `FolderSettingsWindow`), background upload/remove/fit controls, staged
    edits.
  - `src/newtab/components/Canvas.tsx` (+ a new `useCanvasBackground` hook) —
    read the background and apply it to `.canvas`, owning the object-URL
    create/revoke lifecycle and live re-read on storage change.
  - `src/lib/storage/schema.ts` — add a `generalSettings` object and its
    storage key.
  - `src/lib/storage/generalSettings.ts` (new) — read/write the
    `generalSettings` object.
  - `src/lib/storage/canvasBackground.ts` (new, or a reserved-key constant) —
    reserved IndexedDB key `__canvas_background__`, reusing `iconDb`
    put/get/delete.
  - `src/lib/icons/validation.ts` — add `validateBackgroundFile` (10 MB cap,
    same format sniffing) as a separate function from `validateIconFile`.
  - `src/newtab/main.css` — sidebar header + hamburger styles, cloned
    `general-settings-window-*` modal styles, canvas background application.
- Storage schema gains one new key (`generalSettings`); existing keys unchanged.
  Background image bytes live in IndexedDB alongside icons, under a reserved key
  that cannot collide with a Chrome bookmark id.
- No new dependencies. Reuses the modal/portal pattern, `iconDb`,
  `onStorageKeysChanged`, and the icon format-sniffing pipeline.
