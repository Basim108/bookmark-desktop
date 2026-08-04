## MODIFIED Requirements

### Requirement: Folder-to-Folder Drag Nesting
The system SHALL allow dragging one non-root folder onto another folder within the sidebar to reparent it via the `chrome.bookmarks` API, and SHALL leave the stored canvas positions of the moved folder's own bookmarks and nested folders unchanged. Root folders (Chrome's protected top-level folders such as Bookmarks Bar, Other Bookmarks, and Mobile Bookmarks) SHALL NOT be draggable — the system SHALL NOT initiate a drag when a root folder row is grabbed. The system SHALL reject a drop without calling the API if it would create a cycle (dropping a folder onto itself or one of its own descendants).

The sidebar's folder tree SHALL be derived from the actual bookmark tree, never from a local prediction of what a drop is about to do. Exactly one component SHALL decide what a folder drop means; no other component SHALL alter the displayed tree in response to a drop. Consequently, a drop that resolves to no move — onto the dragged folder itself, onto one of its own descendants, onto its current parent, or onto anything that is not a folder — SHALL leave the sidebar exactly as it was before the drag began, with the dragged folder's row still visible in its original position under its original parent.

If an API move is attempted and rejected, the system SHALL resync the sidebar to match the actual bookmark tree.

#### Scenario: Dragging a folder onto another reparents it
- **WHEN** the user drags a non-root folder row and drops it onto another folder row in the sidebar
- **THEN** the dragged folder becomes a child of the target folder via the bookmarks API

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
