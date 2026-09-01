## Why

Chrome's ordinary bookmark flow treats an already-bookmarked URL as the same
bookmark and can move it out of its old folder, while Bookmark Desktop users
need an explicit way to keep independent copies of one URL in different
folders. The bookmark gear is also the natural home for a deliberate move
command and the existing settings entry point.

## What Changes

- Replace the bookmark gear's direct settings action with an anchored menu
  containing `Copy To...`, `Move To...`, a separator, and `Settings` in that
  order.
- Add a shared folder-selection window for copy and move operations, with an
  expandable folder tree and case-insensitive partial-name search.
- Present search results as matching folders only, flattened and labelled with
  their full folder paths.
- Prevent confirmation when no folder is selected or when the selected folder
  is the bookmark's current folder.
- Copy a bookmark into another folder as a new bookmark while preserving all
  current and future user-controlled bookmark-scoped properties, settings, and
  assets, and deliberately regenerating identity, membership, position/order,
  and system timestamps.
- Move a bookmark into another folder while preserving its identity and
  bookmark-scoped data and allowing the existing placement flow to assign a new
  destination position.
- Keep the existing Edit Bookmark window available through the menu's
  `Settings` item.

## Capabilities

### New Capabilities

- `bookmark-transfer-actions`: Bookmark action menu, searchable destination
  selection, complete copy semantics, and explicit move semantics.

### Modified Capabilities

- `bookmark-editor`: The per-bookmark gear opens the new action menu rather than
  opening Edit Bookmark directly; `Settings` becomes the edit-window trigger.

## Impact

- Bookmark canvas components gain an accessible anchored action menu and a
  modal destination picker.
- Bookmark operations gain copy orchestration and reuse the existing
  `chrome.bookmarks.move` path for moves.
- Bookmark settings and icon persistence gain a centralized, future-safe way
  to clone all bookmark-owned metadata while excluding position.
- Existing bookmark-tree reads, bookmark event synchronization, next-free-slot
  placement, Edit Bookmark behavior, and Chrome bookmarks permissions are
  reused. No new external dependency or browser permission is expected.
