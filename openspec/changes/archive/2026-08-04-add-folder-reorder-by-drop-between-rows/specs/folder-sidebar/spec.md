## MODIFIED Requirements

<!-- Builds on the version of this requirement established by the
     `fix-folder-drop-noop-removes-row` change, which this change depends on. -->

### Requirement: Folder-to-Folder Drag Nesting
The system SHALL allow dragging one non-root folder onto another folder within the sidebar to reparent it via the `chrome.bookmarks` API, and SHALL leave the stored canvas positions of the moved folder's own bookmarks and nested folders unchanged. Root folders (Chrome's protected top-level folders such as Bookmarks Bar, Other Bookmarks, and Mobile Bookmarks) SHALL NOT be draggable — the system SHALL NOT initiate a drag when a root folder row is grabbed. The system SHALL reject a drop without calling the API if it would create a cycle (dropping a folder onto itself or one of its own descendants).

The sidebar SHALL additionally offer drop targets *between* folder rows ("gaps"), which reorder rather than reparent. A folder dropped into a gap SHALL move to that position among its siblings while keeping its existing parent, via the `chrome.bookmarks` API. A gap SHALL be expressed as "insert before a given row" and anchored to the top edge of that row, with one additional "insert at end" gap anchored below the last sibling's entire subtree, so the indicated position always matches where the folder will actually land — including when a preceding sibling is expanded.

While a folder is being dragged, a gap SHALL be an active drop target if and only if it is a position within that folder's current parent AND it is not the position immediately before or immediately after the dragged folder's own current position. All other gaps SHALL be inactive: they SHALL show no indicator and SHALL NOT capture the pointer, so the folder row beneath them offers its normal reparent target instead. Consequently the user SHALL NOT be able to perform a reorder drop that results in no change.

Because the sidebar displays only subfolders while a parent's children may also include bookmarks, the system SHALL translate a gap's visible sibling position into the corresponding `chrome.bookmarks` child index rather than using the visible position directly. A reorder SHALL NOT alter any stored canvas position, and SHALL NOT alter the order or placement of any bookmark.

The sidebar's folder tree SHALL be derived from the actual bookmark tree, never from a local prediction of what a drop is about to do. Exactly one component SHALL decide what a folder drop means; no other component SHALL alter the displayed tree in response to a drop. Consequently, a drop that resolves to no move — onto the dragged folder itself, onto one of its own descendants, onto its current parent, into an inactive gap, or onto anything that is not a drop target — SHALL leave the sidebar exactly as it was before the drag began, with the dragged folder's row still visible in its original position under its original parent.

If an API move is attempted and rejected, the system SHALL resync the sidebar to match the actual bookmark tree.

#### Scenario: Dragging a folder onto another reparents it
- **WHEN** the user drags a non-root folder row and drops it onto another folder row in the sidebar
- **THEN** the dragged folder becomes a child of the target folder via the bookmarks API

#### Scenario: Dropping a folder into a gap between its siblings reorders it
- **WHEN** the user drags a folder row and drops it into an active gap between two of its sibling folders
- **THEN** the folder moves to that position among its siblings via the bookmarks API and its parent is unchanged

#### Scenario: Dropping a folder into the gap after its last sibling moves it to the end
- **WHEN** the user drags a folder row and drops it into the gap below the last sibling's subtree
- **THEN** the folder becomes the last subfolder of its existing parent and its parent is unchanged

#### Scenario: Reordering does not change the parent
- **WHEN** a folder is reordered by dropping it into a gap
- **THEN** the folder's parent folder is the same one it had before the drag

#### Scenario: A gap under a different parent is not a drop target
- **WHEN** the user drags a folder and moves the pointer over a gap that is not a position within that folder's current parent
- **THEN** no insert indicator is shown, the gap does not accept the drop, and the folder row beneath the pointer shows its normal drop highlight instead

#### Scenario: The gaps immediately around the dragged folder are not drop targets
- **WHEN** the user drags a folder and moves the pointer over the gap immediately before or immediately after that folder's own current position
- **THEN** no insert indicator is shown and the gap does not accept the drop, because dropping there would change nothing

#### Scenario: A gap indicator matches where the folder lands when a sibling is expanded
- **WHEN** the user drags a folder over the gap that inserts it after an expanded sibling whose descendants are visible
- **THEN** the indicator appears below that sibling's entire visible subtree, at the position where the folder will actually appear after the drop

#### Scenario: A reorder maps the visible position to the correct bookmarks index
- **WHEN** a folder is reordered within a parent whose children include bookmarks interleaved between its subfolders
- **THEN** the resulting subfolder order in the sidebar matches the position the user indicated

#### Scenario: Reordering leaves canvas positions untouched
- **WHEN** a folder is reordered among its siblings
- **THEN** no stored canvas position changes, for that folder's bookmarks or for any other folder's

#### Scenario: Root folders cannot be reordered
- **WHEN** the user attempts to drag a protected root folder
- **THEN** no drag is initiated, so no gap becomes active and no reorder occurs

#### Scenario: Nested contents keep their stored positions
- **WHEN** a folder containing bookmarks and subfolders is moved to a new parent
- **THEN** the stored canvas positions of its bookmarks and subfolders remain unchanged

#### Scenario: Dropping a folder onto itself changes nothing
- **WHEN** the user drags a folder row and drops it back onto its own row
- **THEN** the bookmarks API is not called and the folder's row remains visible in its original position under its original parent

#### Scenario: Dropping a folder onto its own descendant is rejected
- **WHEN** the user drags a folder row and drops it onto one of that folder's own descendant folders
- **THEN** the drop is rejected without calling the bookmarks API and the folder's row remains visible in its original position under its original parent

#### Scenario: Dropping a folder onto its current parent changes nothing
- **WHEN** the user drags a folder row and drops it onto the row of the folder it already belongs to
- **THEN** the bookmarks API is not called and the folder's row remains visible in its original position

#### Scenario: A no-op drop leaves the tree stable without waiting for another event
- **WHEN** a folder drop resolves to no move and no subsequent bookmark create, remove, move, or change event occurs
- **THEN** the sidebar still shows the dragged folder in its original position, rather than showing it removed until some unrelated event resyncs the tree

#### Scenario: Dragging a protected root folder is rejected
- **WHEN** the user attempts to grab and drag a protected root folder (e.g. Bookmarks Bar or Other Bookmarks)
- **THEN** no drag is initiated and the folder remains in its original position

#### Scenario: A rejected move resyncs the sidebar
- **WHEN** a folder move is attempted and `chrome.bookmarks.move` rejects it
- **THEN** the sidebar resyncs to reflect the actual current bookmark tree

### Requirement: Folder Row Hover Affordance
The system SHALL render each folder row with a single transparent-at-rest background covering its entire row — expand-toggle, icon, name, and settings button together — SHALL highlight that full row (same background) on mouse hover and while a drag is over it, SHALL show a pointer cursor while hovering it at rest, and SHALL show a grabbing cursor while the folder row is being actively dragged. The system SHALL also apply that same highlight persistently to whichever folder is currently active/selected, independent of hover or drag state.

The system SHALL distinguish the two folder drop meanings by rendering visually different indicators rather than different intensities of the same one. A drag over a folder row (reparent) SHALL show the full-row highlight described above. A drag over an active gap (reorder) SHALL instead show an insert line: a thin horizontal accent-coloured line with a distinct leading cap, drawn at the dragged folder's own indentation so it aligns with the siblings it will join. The insert line SHALL be rendered in an accent colour distinct from the neutral row highlight, legible in both light and dark colour schemes.

The system SHALL NOT show the row highlight and the insert line at the same time: when the pointer is over an active gap, the gap SHALL take precedence over any row it overlaps. Showing either indicator SHALL NOT change the height or position of any folder row, so rows do not shift under the pointer while dragging.

#### Scenario: Hovering a folder row highlights the entire row
- **WHEN** the mouse moves over any part of a folder's sidebar row, including its expand-toggle or settings button
- **THEN** the entire row is highlighted so the user can see which folder is under the cursor

#### Scenario: Pointer cursor while hovering a folder row
- **WHEN** the mouse is over a folder's sidebar row and no drag is in progress
- **THEN** the cursor is a pointer

#### Scenario: Grabbing cursor while a folder is being dragged
- **WHEN** the user is actively dragging a folder row
- **THEN** the cursor is a grabbing cursor rather than a pointer

#### Scenario: Dragging another item over a folder row highlights it the same as hover
- **WHEN** a bookmark or folder is being dragged over a folder row as a potential drop target
- **THEN** that row shows the same highlight as mouse hover

#### Scenario: Dragging a folder over an active gap shows an insert line
- **WHEN** a folder is being dragged and the pointer is over an active gap between rows
- **THEN** an accent-coloured insert line with a leading cap appears at that gap, at the dragged folder's indentation

#### Scenario: The row highlight and the insert line are never shown together
- **WHEN** the pointer is over an active gap that overlaps the edge of a folder row
- **THEN** only the insert line is shown and that row does not show its drag-over highlight

#### Scenario: Showing an indicator does not shift any row
- **WHEN** an insert line appears, moves to another gap, or disappears during a drag
- **THEN** no folder row changes height or position

#### Scenario: The insert line is legible in both colour schemes
- **WHEN** the insert line is shown in either the light or the dark colour scheme
- **THEN** it is clearly distinguishable from the row background and from the neutral row highlight

#### Scenario: The active folder shows a persistent highlight
- **WHEN** a folder is the currently active/selected folder shown on the canvas
- **THEN** that folder's row shows the same highlight as hover, persistently, regardless of mouse position

#### Scenario: Rows are transparent at rest
- **WHEN** a folder row is neither hovered, drag-targeted, nor the active folder
- **THEN** its background is transparent

### Requirement: Bookmark-to-Folder Drag Move
The system SHALL allow dragging a bookmark icon from the canvas and dropping it onto a folder entry in the sidebar to move that bookmark into the target folder via the `chrome.bookmarks` API. Gaps between folder rows SHALL NOT accept bookmarks: while a bookmark is being dragged, no gap SHALL become an active drop target or show an insert indicator, and folder rows SHALL remain the only sidebar drop targets for a bookmark.

#### Scenario: Dragging a bookmark onto a sidebar folder moves it
- **WHEN** the user drags a bookmark icon from the canvas and drops it onto a folder entry in the sidebar
- **THEN** the bookmark is moved into that folder via the bookmarks API and no longer appears in its previous folder's canvas

#### Scenario: Dragging a bookmark over a gap between folder rows shows no insert indicator
- **WHEN** the user drags a bookmark from the canvas and moves the pointer over a gap between two folder rows
- **THEN** no insert line appears and the gap does not accept the drop

#### Scenario: A bookmark released over a gap is not reordered
- **WHEN** the user drags a bookmark from the canvas and releases it over a gap between two folder rows
- **THEN** no reorder occurs and the bookmark's folder is unchanged
