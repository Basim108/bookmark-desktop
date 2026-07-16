## Why

Folder display settings currently render as a small anchored popup that drops
out of the folder's gear (⚙) button in the sidebar, with its own bespoke
styling and an instant-apply interaction (every radio toggle / icon change
writes immediately). The bookmark settings surface, by contrast, is a
centered modal "Edit Bookmark" window — titlebar, opaque body, staged edits,
and an atomic Save. The two settings surfaces look and behave nothing alike,
which reads as unfinished and makes the folder settings feel like a lesser
control.

This change makes the folder settings surface **absolutely the same style** as
the Edit Bookmark window — a centered modal window with a titlebar, an icon
row, form fields, and a Remove/Save footer — carrying a folder-appropriate set
of settings instead of a bookmark's. It also enlarges the gear (⚙) toggle
button to a 16px font so it reads as a deliberate control rather than a tiny
glyph.

### Relationship to the 2026-07-11 popup change

This partly reverses `2026-07-11-open-folder-settings-as-popup`, which moved the
settings from an inline block to an anchored popup. That change existed to stop
the folder tree from reflowing while editing. A centered modal window preserves
that benefit entirely — it floats over the center of the screen, so sibling and
descendant rows never shift — while giving the settings the same finished
surface as the bookmark window. The motivation behind the popup is kept; only
its presentation and interaction model change.

## What Changes

- Replace the anchored `folder-settings-panel` popup in `FolderTreeNode` with a
  new **`FolderSettingsWindow`** — a centered modal (portaled to
  `document.body`, backdrop dimming, `role="dialog"`/`aria-modal`) that mirrors
  `EditBookmarkWindow`'s structure: titlebar with a "Folder Settings" title and
  ✕ close, an icon row (preview + upload/remove controls), form fields, and a
  Remove/Save footer.
- **Adopt staged → atomic Save.** Folder edits (name, display mode, custom
  icon) are held in memory and committed together on **Save**; closing the
  window, pressing Escape, or clicking the backdrop discards them. This replaces
  the current instant-apply model.
- **Add folder settings to match the bookmark window's shape:**
  - **Name** field — rename the folder (parallels the bookmark's Name), with
    the existing empty/whitespace-only rejection.
  - **Display** — the three existing sidebar display-mode options (Name only /
    Icon only / Icon + name), with the icon options disabled until the folder
    has a custom icon. In the staged model these track the **pending** icon
    state, not the persisted one.
  - **Custom icon** — the existing upload / remove-image controls, staged like
    the bookmark window's, previewed via an object URL until Save.
  - **Remove folder** — a footer button (parallels the bookmark's Remove) with
    a two-step confirm, deleting the folder and its entire subtree.
- Enlarge the gear (⚙) `folder-settings-toggle` button to `font-size: 16px`.
- Add `removeFolder` and `updateFolderTitle` helpers in `lib/bookmarks/edit.ts`
  (folder removal needs `chrome.bookmarks.removeTree`, not `remove`, which
  throws on non-empty folders; rename needs the same empty/whitespace guard the
  spec already mandates).
- Duplicate the modal styling into parallel `.folder-settings-window-*` CSS
  classes (mirroring `.edit-bookmark-*`) so the Edit Bookmark window's markup is
  untouched by this change.
- Remove the now-obsolete popup machinery: anchored positioning, the
  outside-click/Escape handling inside `FolderTreeNode`, and the responsive
  32/48/64px preview sizing (the window uses the bookmark window's fixed 80px
  tile / 64px icon preview instead). `FolderIconPreview` is superseded by the
  window's inline preview.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `folder-sidebar`: the folder display-settings UI changes from an anchored
  popup with instant-apply to a centered modal window with staged/atomic Save,
  gains folder rename and folder removal, and its gear toggle button grows to a
  16px font. The responsive-preview and popup-dismissal behavior is removed in
  favor of the modal window's fixed preview and backdrop/Escape dismissal.

## Impact

- **Affected code:**
  - `src/newtab/components/FolderSettingsWindow.tsx` (new) — the modal window,
    modeled on `EditBookmarkWindow.tsx`.
  - `src/newtab/components/FolderTreeNode.tsx` — gear button opens the modal
    instead of the anchored popup; remove the anchor/outside-click/preview
    machinery. Sidebar's single-open state (`openSettingsFolderId`) is retained
    (a modal is trivially single-instance) or simplified.
  - `src/lib/bookmarks/edit.ts` — add `removeFolder` (via `removeTree`) and
    `updateFolderTitle` (with empty/whitespace guard).
  - `src/newtab/main.css` — new `.folder-settings-window-*` classes; bump
    `.folder-settings-toggle` to `font-size: 16px`; drop the obsolete
    `.folder-settings-panel` / responsive `.folder-settings-icon-preview` rules.
  - `src/newtab/components/FolderIconPreview.tsx` — superseded; remove once the
    window's inline preview replaces it.
- **Cleanup already handled:** removing a folder relies on the existing
  `events.ts` `onRemoved` cascade (`cleanUpRemovedSubtree`), which already walks
  the removed subtree and discards each descendant's positions, settings, and
  icon blobs. No new cleanup code is needed.
- **No storage schema changes.** `useFolderSettings`, `folderSettings.ts`
  (`setFolderSidebarDisplay`, `setFolderHasCustomIcon`, `resolveFolderDisplay`),
  and the `chrome.bookmarks` integration are reused as-is.
- **No new dependencies.** The window is portaled with React's `createPortal`,
  exactly as `EditBookmarkWindow` already does.
