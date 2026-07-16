## ADDED Requirements

### Requirement: Folder Sidebar Row Presentation
The system SHALL render every folder's sidebar row as its icon followed by its name (icon + name), with no per-folder display-mode configuration. A folder that has a custom uploaded image SHALL render that image as its row icon; a folder that has no custom image SHALL render a shared default folder icon stored once (not per folder). Each folder's settings SHALL allow renaming the folder, uploading or removing a custom folder image, and removing the folder, with no inheritance from other folders, presented in a centered modal window matching the Edit Bookmark window's style (titlebar with title and close control, opaque body, and a footer). The modal window SHALL be opened from the folder's settings (gear) toggle button, whose glyph SHALL render at a 16px font size, and SHALL float over the center of the viewport without shifting sibling or descendant folder rows. Folder names SHALL NOT be empty or consist only of whitespace. All edits (name, custom image) SHALL be staged in the window and applied together only when the user saves; closing the window, pressing the Escape key, or clicking the backdrop SHALL discard any unsaved edits. Only one folder's settings window SHALL be open at a time. The window SHALL display a fixed-size preview matching the Edit Bookmark window's preview sizing, showing the staged custom image when one is staged and the default folder icon when none is staged. Removing the folder SHALL delete the folder and its entire subtree, discarding its stored positions, settings, and custom-icon data. The row's icon SHALL be sized according to the browser window's viewport width — 24px below 1024px and 32px at 1024px and above — independent of and unaffected by the settings window's fixed preview sizing.

#### Scenario: Every folder row shows icon and name
- **WHEN** a folder's sidebar row renders
- **THEN** it displays the folder's icon followed by its name, with no option to hide either

#### Scenario: Folder without a custom image shows the default icon
- **WHEN** a folder that has no custom uploaded image renders its sidebar row
- **THEN** the row's icon is the shared default folder icon

#### Scenario: Folder with a custom image shows that image
- **WHEN** a folder that has a custom uploaded image renders its sidebar row
- **THEN** the row's icon is that custom image

#### Scenario: Multiple folders without custom images share one default icon record
- **WHEN** several folders have no custom uploaded image
- **THEN** they all render the same single stored default folder icon rather than a per-folder copy

#### Scenario: Settings open as a centered modal window, not an anchored popup
- **WHEN** the user clicks a folder's settings (gear) toggle button
- **THEN** a centered modal window styled like the Edit Bookmark window opens, and sibling and descendant folder rows do not shift position

#### Scenario: Gear toggle button renders at 16px
- **WHEN** a folder row's settings (gear) toggle button renders
- **THEN** its glyph is displayed at a 16px font size

#### Scenario: Settings window has no display-mode options
- **WHEN** the folder settings window is open
- **THEN** it presents controls for the folder name, custom image upload/removal, and folder removal, and does not present any icon/label display-mode options

#### Scenario: Empty or whitespace-only folder name rejected
- **WHEN** the user attempts to save a folder name that is empty or contains only whitespace
- **THEN** the system rejects the change and does not save

#### Scenario: Edits are staged and applied only on save
- **WHEN** the user changes the name or custom image in the window and clicks Save
- **THEN** all changed values are applied together, and not before Save is clicked

#### Scenario: Closing the window discards unsaved edits
- **WHEN** the folder settings window has unsaved edits and the user closes it, presses Escape, or clicks the backdrop
- **THEN** the window closes and none of the staged edits are applied

#### Scenario: Renaming the folder updates its title
- **WHEN** the user edits the name to a non-empty value and saves
- **THEN** the folder's title is updated via the bookmarks API

#### Scenario: Removing the folder deletes it and its subtree
- **WHEN** the user confirms removal of the folder in the window
- **THEN** the folder and all of its nested bookmarks and subfolders are deleted, and their stored positions, settings, and custom-icon data are discarded

#### Scenario: Only one folder settings window is open at a time
- **WHEN** a folder's settings window is open and the user opens a different folder's settings
- **THEN** the first window closes and the newly selected folder's window opens

#### Scenario: Preview shows staged image or the default icon
- **WHEN** the folder settings window is open
- **THEN** it displays a fixed-size preview of the staged custom image when one is staged, and the default folder icon when none is staged

#### Scenario: Sidebar row icon sized 24px on small screens
- **WHEN** a folder's sidebar row renders and the browser window's viewport width is below 1024px
- **THEN** the row's icon renders at 24px

#### Scenario: Sidebar row icon sized 32px at and above the breakpoint
- **WHEN** a folder's sidebar row renders and the browser window's viewport width is at least 1024px
- **THEN** the row's icon renders at 32px

#### Scenario: Sidebar row icon size is independent of the settings window preview
- **WHEN** a folder's sidebar row renders its icon
- **THEN** the row's icon renders at its viewport-tiered size (24px or 32px), not the fixed size used by the settings window's preview

### Requirement: Root Folders Are Non-Editable Drop Targets
The system SHALL treat root folders (Chrome's protected top-level folders rendered at the top level of the sidebar tree — Bookmarks Bar, Other Bookmarks, Mobile Bookmarks) as non-editable: the system SHALL NOT render a settings (gear) toggle button on a root folder's row, and there SHALL be no way to open a settings window, rename, upload/remove an image for, or remove a root folder from the sidebar. Root folders SHALL remain valid drop targets, accepting a bookmark or a non-root folder dragged onto them, moved via the `chrome.bookmarks` API.

#### Scenario: Root folder row has no settings button
- **WHEN** a root folder's sidebar row renders
- **THEN** it does not display a settings (gear) toggle button, and its settings window cannot be opened

#### Scenario: A bookmark can be dropped into a root folder
- **WHEN** the user drags a bookmark from the canvas and drops it onto a root folder row
- **THEN** the bookmark is moved into that root folder via the bookmarks API

#### Scenario: A non-root folder can be dropped into a root folder
- **WHEN** the user drags a non-root folder row and drops it onto a root folder row
- **THEN** the dragged folder becomes a child of that root folder via the bookmarks API

## MODIFIED Requirements

### Requirement: Folder-to-Folder Drag Nesting
The system SHALL allow dragging one non-root folder onto another folder within the sidebar to reparent it via the `chrome.bookmarks` API, and SHALL leave the stored canvas positions of the moved folder's own bookmarks and nested folders unchanged. Root folders (Chrome's protected top-level folders such as Bookmarks Bar, Other Bookmarks, and Mobile Bookmarks) SHALL NOT be draggable — the system SHALL NOT initiate a drag when a root folder row is grabbed. The system SHALL reject a drop without calling the API if it would create a cycle (dropping a folder onto itself or one of its own descendants). If an API move is attempted and rejected for any other reason, the system SHALL resync the sidebar to match the actual bookmark tree instead of leaving the optimistic UI state stale.

#### Scenario: Dragging a folder onto another reparents it
- **WHEN** the user drags a non-root folder row and drops it onto another folder row in the sidebar
- **THEN** the dragged folder becomes a child of the target folder via the bookmarks API

#### Scenario: Nested contents keep their stored positions
- **WHEN** a folder containing bookmarks and subfolders is moved to a new parent
- **THEN** the stored canvas positions of its bookmarks and subfolders remain unchanged

#### Scenario: Dropping a folder onto its own descendant is rejected
- **WHEN** the user drags a folder row and drops it onto one of that folder's own descendant folders
- **THEN** the drop is rejected without calling the bookmarks API and the folder remains in its original position

#### Scenario: Dragging a protected root folder is rejected
- **WHEN** the user attempts to grab and drag a protected root folder (e.g. Bookmarks Bar or Other Bookmarks)
- **THEN** no drag is initiated and the folder remains in its original position

#### Scenario: A rejected move resyncs the sidebar
- **WHEN** a folder move is attempted and `chrome.bookmarks.move` rejects it
- **THEN** the sidebar resyncs to reflect the actual current bookmark tree instead of retaining the optimistic drag result

## REMOVED Requirements

### Requirement: Folder Sidebar Display Setting
**Reason**: The per-folder three-way display mode (icon-only / label-only / icon+label) is removed. Every folder row now always shows icon + name, with a shared default-icon fallback when no custom image is uploaded. The replacement behavior is captured in the new "Folder Sidebar Row Presentation" requirement.
**Migration**: Existing stored `folderSettings` records carry a now-unused `sidebarDisplay` field; it is ignored on read and harmlessly overwritten on the next write. No destructive migration. Existing custom icons in IndexedDB are unaffected.

### Requirement: Folder Row Consistent Height
**Reason**: Every folder row now always displays an icon, so there is no longer a label-only row whose height must be padded to match an icon row. Row height follows the icon size at the current viewport tier for all rows uniformly, already covered by the icon-sizing scenarios in "Folder Sidebar Row Presentation".
**Migration**: No behavior change for users — all rows already render at the icon-tier height because all rows now show an icon.
