## Context

Each canvas bookmark currently owns a hover-revealed gear that opens
`EditBookmarkWindow` directly. Cross-folder drag already moves bookmarks through
`moveNodeToFolder`, and bookmark events discard the old position and allocate the
next free destination slot. Chrome permits multiple bookmark nodes with the same
URL, and `createBookmark` creates a node without URL deduplication.

Bookmark-owned data is split between the Chrome bookmark node (title and URL),
the complete `BookmarkSettings` record in local storage, and an optional icon
blob in IndexedDB. Position is stored separately by folder and bookmark id. A
copy must cross these stores without accidentally treating position as metadata.

## Goals / Non-Goals

**Goals:**

- Turn the bookmark gear into an accessible action menu for copy, move, and the
  existing settings window.
- Provide one reusable, searchable folder picker for copy and move.
- Preserve every current and future bookmark-owned property, setting, and asset
  when copying unless it is explicitly classified as identity, membership,
  position/order, or system-generated data.
- Keep copy failure from leaving a partially populated bookmark.
- Reuse existing bookmark events and next-free-slot placement.

**Non-Goals:**

- Changing Chrome's native bookmark-star behavior.
- Copying or moving folders.
- Copying a bookmark into its current folder.
- Preserving the source grid slot or Chrome sibling index in the destination.
- Adding folder creation or editing to the destination picker.

## Decisions

### Use an anchored menu as the gear's only immediate action

`BookmarkIcon` will open a dedicated `BookmarkActionMenu`. The items are
`Copy To...`, `Move To...`, a separator, then `Settings`. The menu closes on
selection, outside click, or Escape and implements normal menu focus and arrow
key behavior. `Settings` opens the unchanged `EditBookmarkWindow`.

This keeps one stable per-bookmark affordance while avoiding more controls in an
already compact grid cell. Opening settings directly and adding separate copy
and move controls was rejected because it would crowd the hover surface.

### Use a shared modal folder picker with tree and search modes

`BookmarkFolderPickerWindow` receives the operation, source bookmark, source
folder id, and folder tree. Without a query it renders the ordinary expandable
folder hierarchy. With a nonblank query it renders a flat list of only folders
whose own names contain the trimmed query under case-insensitive matching. Each
match displays its full root-to-folder path, which disambiguates duplicate names
without retaining nonmatching ancestors. Clearing the query restores the prior
tree expansion state.

The source folder remains visible and selectable so search and tree behavior do
not have a surprising exception, but confirmation is disabled for it. It is
also disabled before any selection and during submission.

A modal was chosen over temporarily repurposing the sidebar because it provides
an explicit operation, confirmation, cancellation, focus boundary, and error
surface. A flat folder dropdown was rejected because nested folders and duplicate
names are difficult to understand without paths.

### Centralize copy semantics around complete bookmark-owned records

A bookmark-copy operation will:

1. Read the source's complete `BookmarkSettings` value and optional icon before
   mutating anything.
2. Create a new Chrome bookmark in the destination using the source title and
   URL.
3. Write the complete settings object under the new id and copy the icon blob
   under the new id.
4. Return the new node and let the existing `onCreated` listener allocate its
   next-free destination slot.

The storage layer will expose a complete-record setter or clone helper rather
than reconstructing settings from named fields. Consequently, adding a field to
`BookmarkSettings` automatically carries it through the copy. Bookmark-owned
assets that live outside that record must register with or extend the centralized
metadata clone operation when introduced. A contract test will place an extra
field in the source record and verify it survives without field-specific copy
logic.

The exclusion boundary is explicit: Chrome id, parent id, sibling index, grid
position, and Chrome-generated dates are newly assigned rather than copied.
This exclusion-based contract is preferred to an allowlist of today's fields,
which would silently lose future settings.

### Roll back an incomplete copy; leave failed moves unchanged

If creation succeeds but any metadata or asset write fails, the operation will
remove the newly created bookmark and rely on the existing removal cascade to
clean its destination position and partial metadata. The picker remains open and
shows an inline failure message. Cleanup failure is also reported rather than
claiming atomicity.

Moves use `moveNodeToFolder`. A rejected move leaves the picker open, reports the
error, and relies on existing bookmark resynchronization behavior. Successful
moves preserve the id and all id-keyed metadata while the `onMoved` listener
assigns a fresh destination slot.

## Risks / Trade-offs

- [Copy spans Chrome storage, local storage, and IndexedDB without a shared
  transaction] -> Read the source first, apply writes in a defined order, and
  compensate by deleting the new bookmark on failure.
- [A future bookmark-owned asset could be stored outside `BookmarkSettings` and
  omitted] -> Make the centralized clone operation the documented integration
  boundary and cover each registered asset store with contract tests.
- [Very large bookmark trees make filtering expensive] -> Flatten folder names
  and paths once when the picker opens, then filter the in-memory entries.
- [Anchored menus can overflow a cell near viewport edges] -> Position against
  the gear and flip horizontally or vertically when space is insufficient.
- [Folder names and paths may be identical] -> Use bookmark ids as selection
  identity; paths are explanatory labels, not keys.

## Migration Plan

No stored-data migration is required. Existing bookmark ids, settings, icons,
and positions retain their current formats. The UI trigger changes in place,
and removing the feature can restore the gear's direct settings behavior without
converting user data. Copies already created are ordinary Chrome bookmarks and
remain valid after rollback.

## Open Questions

None.
