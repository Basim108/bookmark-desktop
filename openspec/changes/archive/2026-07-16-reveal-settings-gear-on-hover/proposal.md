## Why

The settings (gear) buttons on bookmark cells and folder rows are always visible, adding persistent visual clutter to the desktop and sidebar. Since editing is an occasional action, the gear should stay out of the way at rest and appear only when the user is actually pointing at (or keyboard-focused on) the item it belongs to.

## What Changes

- Hide the bookmark cell's settings gear (`.bookmark-icon-settings-toggle`) at rest; reveal it only while the mouse hovers the bookmark's occupied grid cell.
- Hide the folder row's settings gear (`.folder-settings-toggle`) at rest; reveal it only while the mouse hovers the folder row.
- Also reveal each gear when it receives keyboard focus, and keep it revealed while its settings window is open, so the control stays reachable for keyboard and accessibility users.
- Reveal/hide via `opacity` (not `display`/removal) so the row and cell layout does not shift as the gear appears.
- No change to the gear's click behavior: activating it opens the same Edit Bookmark / Folder Settings window exactly as today.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `bookmark-editor`: the per-bookmark edit trigger on the canvas is hidden at rest and revealed on hover of the bookmark's cell or on keyboard focus; its activation behavior is unchanged.
- `folder-sidebar`: the folder row's settings (gear) toggle is hidden at rest and revealed on hover of the folder row or on keyboard focus; its activation behavior and layout are otherwise unchanged.

## Impact

- **CSS** (`src/newtab/main.css`): rest-state hiding and hover/focus reveal rules for `.bookmark-icon-settings-toggle` (revealed via `.grid-cell--occupied:hover` and focus) and `.folder-settings-toggle` (revealed via `.folder-row:hover` and focus).
- **Components**: no structural/JSX changes expected in `BookmarkIcon.tsx` or `FolderTreeNode.tsx`; behavior is purely presentational. Root folders remain unaffected (they render no gear at all).
- **Tests**: existing tests assert the gear exists in the DOM and is clickable — those continue to pass since the button remains present (only visually hidden). Optional coverage may assert the rest-hidden / hover-revealed styling.
- No changes to storage, APIs, or bookmark/folder data.
