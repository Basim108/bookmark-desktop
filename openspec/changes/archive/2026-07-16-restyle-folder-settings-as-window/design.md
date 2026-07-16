# Design

## Goal

Make the folder settings surface visually and behaviorally identical to the
Edit Bookmark window (`EditBookmarkWindow.tsx`), carrying a folder-appropriate
set of settings. "Absolutely the same style" is read as: same modal-window
chrome (titlebar + ✕, opaque centered body, backdrop), same staged→Save
interaction, same icon-row / field / footer layout.

## Target layout

```
┌──────────────────────────────────────────┐
│ Folder Settings                     ✕     │  titlebar (title + close)
├──────────────────────────────────────────┤
│ ┌──────┐   Upload image   Remove image    │  icon row
│ │ icon │   Upload a custom image for this  │   preview: 80px tile / 64px icon
│ └──────┘   folder.                         │   (fixed, not responsive)
│                                            │
│ Name       [______________________]        │  rename field
│                                            │
│ Display    ○ Name only                     │  display-mode radios
│            ○ Icon only        (disabled    │   icon options gated on the
│            ○ Icon + name       w/o icon)   │   PENDING icon state
├──────────────────────────────────────────┤
│ Remove folder                    Save      │  footer (two-step confirm on left)
└──────────────────────────────────────────┘
```

## Decisions

### 1. Staged → atomic Save (parity with the bookmark window)

The window holds all edits in memory and commits them on Save; close / Escape /
backdrop click discard. This mirrors `EditBookmarkWindow`'s `PendingIcon` +
local `useState` approach exactly.

- Staged fields: `name`, `sidebarDisplay`, and a `pendingIcon`
  (`unchanged | upload | removed`) identical in shape to the bookmark window's.
- On Save, apply in a fixed order, then `onSaved()` + `onClose()`:
  1. Icon: `putIcon` + `setFolderHasCustomIcon(id, true)` on upload;
     `deleteIcon` + `setFolderHasCustomIcon(id, false)` on removal.
  2. Title: `updateFolderTitle(id, name)` (rejects empty/whitespace).
  3. Display: `setFolderSidebarDisplay(id, resolvedDisplay)`.
- The staged upload's object URL is revoked on replace/unmount, exactly as
  `EditBookmarkWindow` does, so a discarded preview never leaks.

### 2. The display/icon dependency under staging (the subtle part)

`setFolderSidebarDisplay` throws if a non-`label-only` mode is set while the
folder has no custom icon, and `setFolderHasCustomIcon(id, false)` already
forces `sidebarDisplay` back to `label-only`. Under staging, "has a custom
icon" is a **pending** value, so:

- Radio enablement tracks `hasCustomIconNow` (pending upload OR
  (unchanged AND persisted `hasCustomIcon`)) — the same derivation the bookmark
  window uses for its `hasCustomIconNow`.
- If the user stages an icon **removal** while an icon-requiring display mode is
  selected, the staged display must fall back to `label-only` before Save so the
  storage call never throws. Enforce this in the resolved value passed to
  `setFolderSidebarDisplay` (compute `resolvedDisplay = hasCustomIconNow ?
  stagedDisplay : "label-only"`), which also matches `resolveFolderDisplay`'s
  existing clamp semantics.
- Apply icon changes **before** the display change on Save so
  `setFolderHasCustomIcon` and `setFolderSidebarDisplay` see a consistent state.

### 3. Folder removal needs `removeTree`, not `remove`

`chrome.bookmarks.remove(id)` throws on a non-empty folder. The Remove-folder
button therefore cannot reuse `removeBookmark`. Add:

```ts
// lib/bookmarks/edit.ts
export async function removeFolder(id: string): Promise<void> {
  await chrome.bookmarks.removeTree(id);
}
```

Cleanup is already handled: `removeTree` fires a single `onRemoved` carrying the
whole subtree node, and `events.ts` `cleanUpRemovedSubtree` recursively discards
positions/settings/icons for the folder and every descendant. No new cleanup
code.

Removal reuses the bookmark window's two-step confirm ("Remove folder" →
"Confirm remove") so an irreversible subtree delete isn't one stray click away.

### 4. Folder rename

No folder-rename helper exists. `chrome.bookmarks.update(id, { title })` works
for folders, but the spec already forbids empty/whitespace folder names, so wrap
it:

```ts
// lib/bookmarks/edit.ts
export async function updateFolderTitle(
  id: string,
  title: string,
): Promise<BookmarkEditResult> {
  const trimmed = title.trim();
  if (trimmed.length === 0) return { ok: false, error: "empty-title" };
  await chrome.bookmarks.update(id, { title: trimmed });
  return { ok: true };
}
```

Save is disabled while the name is empty/whitespace, matching the bookmark
window's `nameValid` gate.

### 5. Duplicated CSS, not shared

Per the chosen approach, the modal styling is **copied** into parallel
`.folder-settings-window-*` classes rather than generalized into shared classes.
This keeps `EditBookmarkWindow`'s markup and the `.edit-bookmark-*` rules
completely untouched.

- **Accepted tradeoff:** the two windows can drift apart over time, since a
  future tweak to one set of classes won't reach the other. If they must stay
  identical long-term, a later change can consolidate them into shared
  `.settings-window-*` classes.

### 6. Trigger and dismissal

The gear (⚙) `folder-settings-toggle` opens the modal instead of the anchored
popup. Because the modal is portaled and centered:

- The anchored-popup machinery in `FolderTreeNode` is removed: absolute
  positioning, the `pointerdown` outside-click handler, the toggle/panel refs,
  and the `folder-settings-panel` layout.
- Backdrop-click and Escape dismissal move into `FolderSettingsWindow` (same as
  `EditBookmarkWindow`).
- Sidebar's lifted `openSettingsFolderId` state is retained to decide which
  folder's window is open (a modal is naturally single-instance, so
  "only one open at a time" is now trivially satisfied). It can be kept as-is or
  simplified to a boolean-per-node; retaining the lifted id is the smaller diff.

### 7. Preview sizing

The window uses the bookmark window's fixed **80px tile / 64px icon** preview.
The popup's responsive 32/48/64px preview sizing (and `FolderIconPreview`) are
dropped — a fixed preview is what "same style" implies, and it removes three
viewport-breakpoint scenarios from the spec.

## Risks / edge cases to verify

- Staging an icon removal while "Icon only" / "Icon + name" is selected, then
  saving, must land on `label-only` without throwing.
- Removing the folder that is currently the **active/selected** folder on the
  canvas — the canvas should react via the existing live-sync path once the
  `onRemoved` cascade fires.
- Renaming to a name differing only by surrounding whitespace should be a no-op
  after trim, not an error.
- Escape must dismiss the window without saving even mid-upload.
