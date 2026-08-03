## Why

Opening a folder's settings window, the New Folder draft, or the Edit Bookmark
window leaves keyboard focus wherever it was. Renaming — the most common reason
to open any of them — therefore always costs a click before a keystroke, and a
keyboard-only user has to tab into the field past the window's other controls.

There is currently no `autoFocus` and no `.focus()` call anywhere in
`src/newtab/`, so nothing in these windows directs attention on open. This is
the first focus management in the codebase and sets the pattern for it.

## What Changes

- Opening the folder settings window (edit or create mode) or the Edit Bookmark
  window SHALL move keyboard focus to the `Name` field.
- The field's contents SHALL **not** be selected. Focus alone leaves the caret
  after the existing text, so the first keystroke extends the name rather than
  wiping it.

  Selecting was tried first, on the reasoning that Finder and Explorer select a
  filename on rename. In use it felt wrong: a selected name is one keystroke
  from being gone, and these windows are opened to adjust a name at least as
  often as to replace it outright. Focus removes the click; selection would have
  made the destructive outcome the default.

  | window | initial value | on open |
  | --- | --- | --- |
  | Folder settings (edit) | `folder.title` | focused, caret after the text |
  | New Folder draft | `""` | focused, empty |
  | Edit Bookmark | `bookmark.title` | focused, caret after the text |

### Not doing

- **No focus trap.** These windows have never confined Tab within themselves.
  Autofocus is an improvement independent of that, and a trap carries its own
  design questions — where Tab wraps, what Shift+Tab does at the first control,
  how it interacts with the backdrop-click and Escape dismissals these windows
  already have. Adding one here would smuggle a much larger change in behind a
  one-line one.
- **No autofocus in the General Settings window.** It has no Name field and no
  single obviously-primary control, so there is nothing to focus that would not
  be an arbitrary choice.
- **No change to how these windows are dismissed or saved.**

## Capabilities

### New Capabilities

None.

### Modified Capabilities

Both capabilities gain a new requirement rather than having an existing one
rewritten. Focus-on-open is a new concern layered onto these windows, not a
change to the behaviour their current requirements describe — and those
requirements (`Folder Sidebar Row Presentation` runs to some 70 lines) would
have to be reproduced in full to be modified, obscuring a small change inside a
large diff.

- `folder-sidebar`: ADDED **Folder Settings Window Focuses Its Name Field**,
  covering both the edit and New Folder draft modes.
- `bookmark-editor`: ADDED **Edit Bookmark Window Focuses Its Name Field**.

## Impact

**Code**

- `src/newtab/components/FolderSettingsWindow.tsx` — focus the name input on
  mount; select its contents when non-empty (`:89`, `useState(folder?.title ?? "")`).
- `src/newtab/components/EditBookmarkWindow.tsx` — the same (`:58`,
  `useState(bookmark.title)`).

**Tests**

- Both windows: focus lands on the Name field on open.
- Pre-filled values are selected; the empty New Folder draft simply has focus.
- Typing immediately after open replaces an existing name rather than appending
  — the behaviour the selection exists to produce, asserted through the input's
  resulting value rather than through `selectionStart`/`selectionEnd` alone.

**Not affected**

Saving, validation, and dismissal. Only what has focus when the window appears.

**Note**

`simplify-utab-import-flow` also edits `FolderSettingsWindow.tsx`, removing its
import state. The two changes touch different parts of that file and are
independent, but whichever lands second will want a quick re-read rather than a
blind merge.
