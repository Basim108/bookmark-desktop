## Why

Two rough edges in the folder sidebar:

1. **Chrome's protected root folders are treated as editable.** Bookmarks Bar,
   Other Bookmarks, and Mobile Bookmarks each render a settings (gear) button
   and start a drag when grabbed, even though `chrome.bookmarks.move` rejects
   moving them and renaming/removing them makes no sense. The drag ghost
   follows the cursor only to have the drop silently rejected — misleading UI
   for an operation that can never succeed.

2. **The per-folder "Display" setting is more configurability than the design
   wants.** Folders can be set to icon-only, label-only, or icon+label, gated
   on whether a custom image was uploaded, with clamping logic spread across
   the storage layer, the settings window, and the tree node. In practice a
   folder row should always show an icon *and* a name; a folder without a
   custom image should simply fall back to a default folder icon rather than
   collapsing to label-only.

Removing the display dimension and locking down root folders simplifies the
storage schema, the settings window, and the rendering path, and makes the
sidebar behave predictably.

## What Changes

**Root folders (depth-0 rows: Bookmarks Bar / Other Bookmarks / Mobile Bookmarks)**

- Do not render the settings (gear) button — root folders are not editable.
- Are not draggable: no `useDraggable` wiring, so no drag ghost and no
  grabbing cursor when grabbed.
- **Remain valid drop targets** — a bookmark or a normal folder can still be
  dragged *into* a root folder. Only dragging the root itself is removed.

**Folder sidebar display**

- Every folder row always renders **icon + name**. The three-way display
  setting (icon-only / label-only / icon+label) is removed.
- The `Display` radio group is removed from the folder settings window.
- A folder with a custom uploaded image shows that image; a folder **without**
  one shows a shared **default folder icon**.
- The default folder icon is stored **once** in IndexedDB under a well-known
  key (not per folder), reusing the existing binary→object-URL icon pipeline.
  It is seeded from a bundled `folder.png` asset on first run. Multiple
  folders without custom icons all render this single shared record.

**Storage / schema**

- Remove `sidebarDisplay` from `FolderSettings`; the interface keeps
  `hasCustomIcon` (used to choose the custom-icon key vs. the default key) and
  remains the home for future per-folder settings.
- Remove `FolderSidebarDisplay`, `resolveFolderDisplay`, and
  `setFolderSidebarDisplay`. `folderSettings` storage and the
  `useFolderSettings` hook stay.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `folder-sidebar`: root folders become non-editable and non-draggable (but
  still drop targets); the per-folder display-mode setting is removed in favor
  of always showing icon + name with a shared default-icon fallback.

## Impact

- **Affected code:**
  - `src/newtab/components/FolderTreeNode.tsx` — gate the gear button and
    `useDraggable` on `depth > 0`; always render icon + name; choose the
    default-icon key when `hasCustomIcon` is false.
  - `src/newtab/components/FolderSettingsWindow.tsx` — remove the Display radio
    group, `DISPLAY_OPTIONS`, and the display-clamping logic in `handleSave`;
    show the default icon in the preview when no custom image is staged.
  - `src/lib/storage/schema.ts` — drop `FolderSidebarDisplay` and
    `sidebarDisplay`; `FolderSettings` becomes `{ hasCustomIcon: boolean }`.
  - `src/lib/storage/folderSettings.ts` — remove `resolveFolderDisplay` /
    `setFolderSidebarDisplay`; simplify `DEFAULT_FOLDER_SETTINGS` and
    `setFolderHasCustomIcon`.
  - `src/lib/storage/iconDb.ts` (or a small new module) — a well-known
    default-icon key + a one-time seed of the bundled `folder.png`.
  - A bundled asset for the default icon (e.g. `src/newtab/assets/folder.png`,
    sourced from `design/examples/folder.png`).
- **No dependency changes.** The default-icon seed reuses the existing
  IndexedDB `putIcon`/`getIcon` path.
- **Migration:** existing stored `folderSettings` records carry a now-unused
  `sidebarDisplay` field; it is simply ignored on read (no destructive
  migration required). Existing custom icons in IndexedDB are unaffected.
- **Tests:** update `FolderSettingsWindow.test.tsx`, `FolderTreeNode.test.tsx`,
  and `folderSettings.test.ts` for the removed display mode; add coverage for
  the default-icon fallback and for root folders lacking a gear / drag handle.
