## ADDED Requirements

### Requirement: Folder Tree Sidebar
The system SHALL display the Chrome bookmark folder tree in a sidebar, in Chrome's native folder order, and SHALL NOT render folders as icons on the canvas.

#### Scenario: Sidebar reflects Chrome's native folder order
- **WHEN** the sidebar renders a folder's subfolders
- **THEN** they appear in the same order Chrome's native bookmark manager displays them

#### Scenario: Folders never appear on the canvas
- **WHEN** any folder is selected or viewed
- **THEN** no folder is ever rendered as an icon on the canvas; only bookmarks (leaf items) appear there

### Requirement: Folder Selection Filtering
The system SHALL set the canvas's active folder to whichever folder the user selects in the sidebar.

#### Scenario: Selecting a folder in the sidebar updates the canvas
- **WHEN** the user selects a folder in the sidebar
- **THEN** the canvas becomes filtered to that folder's direct bookmark children

### Requirement: Folder Sidebar Display Setting
The system SHALL allow each folder to independently configure its sidebar row display as icon-only, label-only, or both icon and label, with no inheritance from other folders. The icon display option SHALL be unavailable until the folder has a custom uploaded image. Folder names SHALL NOT be empty or consist only of whitespace.

#### Scenario: Icon display unavailable without a custom image
- **WHEN** a folder has no custom uploaded image
- **THEN** the icon-only and icon+label display options are disabled for that folder

#### Scenario: Icon display available with a custom image
- **WHEN** a folder has a custom uploaded image
- **THEN** the user can set that folder's sidebar display to icon-only, label-only, or both

#### Scenario: Empty or whitespace-only folder name rejected
- **WHEN** the user attempts to save a folder name that is empty or contains only whitespace
- **THEN** the system rejects the change

### Requirement: Folder-to-Folder Drag Nesting
The system SHALL allow dragging one folder onto another within the sidebar to reparent it via the `chrome.bookmarks` API, and SHALL leave the stored canvas positions of the moved folder's own bookmarks and nested folders unchanged.

#### Scenario: Dragging a folder onto another reparents it
- **WHEN** the user drags a folder row and drops it onto another folder row in the sidebar
- **THEN** the dragged folder becomes a child of the target folder via the bookmarks API

#### Scenario: Nested contents keep their stored positions
- **WHEN** a folder containing bookmarks and subfolders is moved to a new parent
- **THEN** the stored canvas positions of its bookmarks and subfolders remain unchanged

### Requirement: Bookmark-to-Folder Drag Move
The system SHALL allow dragging a bookmark icon from the canvas and dropping it onto a folder entry in the sidebar to move that bookmark into the target folder via the `chrome.bookmarks` API.

#### Scenario: Dragging a bookmark onto a sidebar folder moves it
- **WHEN** the user drags a bookmark icon from the canvas and drops it onto a folder entry in the sidebar
- **THEN** the bookmark is moved into that folder via the bookmarks API and no longer appears in its previous folder's canvas

### Requirement: Live Cross-Tab Structure Sync
The system SHALL propagate bookmark/folder structure changes live to all currently open new-tab pages within the same browser profile, regardless of whether the change originated in the extension or in Chrome's native bookmark manager.

#### Scenario: Structure change in one tab reflects in another
- **WHEN** a bookmark or folder is created, moved, or removed in one open new-tab page or in Chrome's native bookmark manager
- **THEN** all other currently open new-tab pages update to reflect the change without requiring a manual reload
