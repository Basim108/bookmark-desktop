## ADDED Requirements

### Requirement: Bookmark Action Menu
The system SHALL open an anchored action menu when the user activates a canvas
bookmark's gear. The menu SHALL contain `Copy To...`, `Move To...`, a separator,
and `Settings` in that order. It SHALL close after an item is activated, when the
user clicks outside it, or when the user presses Escape, and SHALL support
standard keyboard menu navigation. Its placement SHALL remain within the
viewport by flipping around its anchor when necessary.

#### Scenario: Gear opens the ordered menu
- **WHEN** the user activates a bookmark's gear
- **THEN** an anchored menu opens with Copy To and Move To above a separator and Settings below it

#### Scenario: Menu closes without an action
- **WHEN** the menu is open and the user clicks outside it or presses Escape
- **THEN** the menu closes and no bookmark operation or settings window opens

#### Scenario: Menu supports keyboard operation
- **WHEN** a keyboard user opens and navigates the menu
- **THEN** focus moves among its items with standard menu keys and Enter activates the focused item

#### Scenario: Menu remains inside the viewport
- **WHEN** the gear is too close to a viewport edge for the menu's preferred placement
- **THEN** the menu is placed on an alternate side of the gear without overflowing the viewport

### Requirement: Shared Destination Folder Window
The system SHALL open the same modal folder-selection window for Copy To and
Move To, titled to identify the operation and source bookmark. With no search
query the window SHALL show all root and nested bookmark folders as an
expandable tree. The window SHALL make no bookmark change until the user confirms
a valid destination with OK.

#### Scenario: Copy opens the destination window
- **WHEN** the user activates Copy To for a bookmark
- **THEN** a modal folder-selection window opens for copying that bookmark

#### Scenario: Move opens the destination window
- **WHEN** the user activates Move To for a bookmark
- **THEN** the same modal folder-selection window opens for moving that bookmark

#### Scenario: Empty search shows the folder hierarchy
- **WHEN** the destination window is open with an empty or whitespace-only search query
- **THEN** it shows all available folders as an expandable hierarchy

#### Scenario: Cancelling makes no change
- **WHEN** the user closes or cancels the destination window before confirming
- **THEN** no bookmark is created, moved, or modified

### Requirement: Destination Folder Search
The destination window SHALL provide a search field. A nonblank query SHALL be
trimmed and matched case-insensitively as a substring of each folder's own name.
While searching, the system SHALL replace the tree with a flat list containing
only matching folders, and SHALL label every result with its complete path from
its root folder. It SHALL preserve the tree's expansion state and restore it when
the query is cleared.

#### Scenario: Partial search filters case-insensitively
- **WHEN** the user searches for `proj`
- **THEN** folders named `Projects` and `Old Projects` appear regardless of letter case and folders whose own names do not contain `proj` are hidden

#### Scenario: Search matches the folder name rather than its ancestors
- **WHEN** a folder's own name does not match the query but one of its ancestor names does
- **THEN** that folder is absent from the search results

#### Scenario: Search results show complete paths
- **WHEN** matching folders are nested or share the same name
- **THEN** each match is shown in a flat result list with its complete root-to-folder path

#### Scenario: No folder matches
- **WHEN** no folder name contains the search query
- **THEN** the window shows a no-folders-found state and OK remains disabled

#### Scenario: Clearing search restores the tree
- **WHEN** the user expands folders, enters a query, and then clears it
- **THEN** the hierarchical tree returns with its previous expansion state

### Requirement: Valid Destination Required
The system SHALL enable OK only when the user has selected a destination folder
different from the bookmark's current folder and no operation is in progress.
The current folder SHALL remain visible and selectable, but selecting it SHALL
leave OK disabled for both copy and move.

#### Scenario: No destination selected
- **WHEN** the destination window opens and no folder has been selected
- **THEN** OK is disabled

#### Scenario: Current folder selected for copy
- **WHEN** the user selects the bookmark's current folder in a Copy To window
- **THEN** OK remains disabled and no duplicate can be created in that folder

#### Scenario: Current folder selected for move
- **WHEN** the user selects the bookmark's current folder in a Move To window
- **THEN** OK remains disabled and no move can be submitted

#### Scenario: Different folder selected
- **WHEN** the user selects a destination other than the bookmark's current folder
- **THEN** OK is enabled unless an operation is already running

### Requirement: Complete Bookmark Copy Without Position
When Copy To is confirmed, the system SHALL create an independent Chrome
bookmark in the selected folder with a new bookmark id. It SHALL copy every
user-controlled bookmark-scoped property, complete settings record, and owned
asset from the source. Copy semantics SHALL be exclusion-based: the new copy
SHALL NOT inherit the source's id, parent id, sibling index, grid position, or
system-generated timestamps. Newly introduced bookmark settings fields SHALL be
copied without requiring field-specific additions to the copy operation, and
new bookmark-owned asset stores SHALL participate through the centralized
bookmark metadata-copy boundary.

#### Scenario: Copy preserves all current bookmark-owned data
- **WHEN** a bookmark with a name, URL, custom icon, and nondefault settings is copied to another folder
- **THEN** the new bookmark has an independent id and equivalent user-controlled properties, complete settings, and icon

#### Scenario: Copy receives a new destination position
- **WHEN** a bookmark is copied to another folder
- **THEN** its source position is not copied and the normal new-bookmark placement assigns the next free destination slot

#### Scenario: Future settings fields copy automatically
- **WHEN** the source bookmark's complete settings record contains a bookmark-scoped field introduced after this feature
- **THEN** the destination settings record contains the same field and value without field-specific copy logic

#### Scenario: Source remains unchanged
- **WHEN** a bookmark is successfully copied to another folder
- **THEN** the original bookmark remains in its original folder with its id, position, properties, settings, and assets unchanged

#### Scenario: Same URL may exist in different folders
- **WHEN** a URL already bookmarked in one folder is copied to a different folder
- **THEN** both independent bookmark nodes continue to exist in their respective folders

### Requirement: Bookmark Move From Menu
When Move To is confirmed, the system SHALL move the existing Chrome bookmark
to the selected folder. The move SHALL preserve the bookmark's id and all
bookmark-scoped properties, settings, and assets, while the normal cross-folder
placement flow discards its source position and assigns the next free destination
slot.

#### Scenario: Move preserves identity and metadata
- **WHEN** a bookmark is moved to another folder through Move To
- **THEN** the bookmark keeps its id, properties, complete settings, and owned assets

#### Scenario: Move receives a new destination position
- **WHEN** a bookmark is moved to another folder through Move To
- **THEN** its old stored position is discarded and it receives the next free slot in the destination folder

### Requirement: Transfer Submission and Failure Handling
The system SHALL disable destination controls while a copy or move is running so
the operation cannot be submitted twice. It SHALL close the window after success
and keep it open with an inline error after failure. If bookmark creation
succeeds but copying any bookmark-owned settings or asset fails, the system
SHALL attempt to remove the incomplete bookmark and its partial associated data
and SHALL NOT report success.

#### Scenario: Running operation cannot be submitted twice
- **WHEN** the user confirms a valid copy or move and it is still running
- **THEN** the destination controls and OK are disabled until the operation completes

#### Scenario: Successful operation closes the window
- **WHEN** a copy or move completes successfully
- **THEN** the destination window closes

#### Scenario: API failure remains visible
- **WHEN** bookmark creation or movement fails before completion
- **THEN** the destination window stays open and shows an inline error

#### Scenario: Metadata-copy failure rolls back the copy
- **WHEN** the Chrome bookmark is created but copying its settings or an owned asset fails
- **THEN** the system attempts to delete the incomplete bookmark and partial associated data, keeps the window open, and reports the failure

#### Scenario: Rollback failure is not hidden
- **WHEN** cleanup of an incomplete copied bookmark also fails
- **THEN** the window reports that cleanup was incomplete rather than claiming the copy succeeded or was fully rolled back
