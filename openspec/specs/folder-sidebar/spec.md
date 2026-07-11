# folder-sidebar Specification

## Purpose
TBD - created by archiving change bookmark-desktop-new-tab. Update Purpose after archive.
## Requirements
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
The system SHALL allow each folder to independently configure its sidebar row display as icon-only, label-only, or both icon and label, with no inheritance from other folders, presented in a popup anchored to that folder's settings toggle button rather than as an inline panel that reflows sibling or descendant rows. The icon display option SHALL be unavailable until the folder has a custom uploaded image. Folder names SHALL NOT be empty or consist only of whitespace. The popup SHALL close when the user clicks outside it or presses the Escape key, and SHALL allow only one folder's settings popup to be open at a time across the sidebar. When the folder has a custom uploaded image, the popup SHALL display a preview of that image sized according to the browser window's viewport width — 32px below 1024px, 48px from 1024px up to (but not including) 1600px, and 64px at 1600px and above. When a folder's sidebar row displays its custom icon (icon-only or icon+label mode), the row's icon SHALL be sized according to the browser window's viewport width — 24px below 1024px and 32px at 1024px and above — independent of and unaffected by the popup preview's sizing.

#### Scenario: Icon display unavailable without a custom image
- **WHEN** a folder has no custom uploaded image
- **THEN** the icon-only and icon+label display options are disabled for that folder

#### Scenario: Icon display available with a custom image
- **WHEN** a folder has a custom uploaded image
- **THEN** the user can set that folder's sidebar display to icon-only, label-only, or both

#### Scenario: Empty or whitespace-only folder name rejected
- **WHEN** the user attempts to save a folder name that is empty or contains only whitespace
- **THEN** the system rejects the change

#### Scenario: Opening settings shows a popup instead of reflowing the tree
- **WHEN** the user clicks a folder's settings toggle button
- **THEN** the display-mode and icon-upload controls appear in a popup anchored to that button, and sibling and descendant folder rows do not shift position

#### Scenario: Clicking outside the popup closes it
- **WHEN** the folder settings popup is open and the user clicks anywhere outside the popup
- **THEN** the popup closes

#### Scenario: Pressing Escape closes the popup
- **WHEN** the folder settings popup is open and the user presses the Escape key
- **THEN** the popup closes

#### Scenario: Opening another folder's popup closes the previous one
- **WHEN** a folder's settings popup is open and the user clicks a different folder's settings toggle button
- **THEN** the first folder's popup closes and the newly selected folder's popup opens

#### Scenario: Icon preview appears with a custom image
- **WHEN** the settings popup opens for a folder that has a custom uploaded image
- **THEN** the popup displays a preview of that image

#### Scenario: No icon preview without a custom image
- **WHEN** the settings popup opens for a folder that has no custom uploaded image
- **THEN** the popup does not display an icon preview

#### Scenario: Icon preview sized 32px on small screens
- **WHEN** the settings popup is open with an icon preview and the browser window's viewport width is below 1024px
- **THEN** the preview renders at 32px

#### Scenario: Icon preview sized 48px on medium-to-large screens
- **WHEN** the settings popup is open with an icon preview and the browser window's viewport width is at least 1024px and below 1600px
- **THEN** the preview renders at 48px

#### Scenario: Icon preview sized 64px on ultra-large screens
- **WHEN** the settings popup is open with an icon preview and the browser window's viewport width is at least 1600px
- **THEN** the preview renders at 64px

#### Scenario: Sidebar row icon sized 24px on small screens
- **WHEN** a folder's sidebar row displays its custom icon and the browser window's viewport width is below 1024px
- **THEN** the row's icon renders at 24px

#### Scenario: Sidebar row icon sized 32px at and above the breakpoint
- **WHEN** a folder's sidebar row displays its custom icon and the browser window's viewport width is at least 1024px
- **THEN** the row's icon renders at 32px

#### Scenario: Sidebar row icon size is independent of the popup preview
- **WHEN** the browser window's viewport width is at least 1600px
- **THEN** a folder's sidebar row icon renders at 32px, not the 64px used by the settings popup preview at that width

### Requirement: Folder-to-Folder Drag Nesting
The system SHALL allow dragging one folder onto another within the sidebar to reparent it via the `chrome.bookmarks` API, and SHALL leave the stored canvas positions of the moved folder's own bookmarks and nested folders unchanged. The system SHALL reject the drop without calling the API if it would create a cycle (dropping a folder onto itself or one of its own descendants) or would move a protected root folder (e.g. Bookmarks Bar, Other Bookmarks). If the API move is attempted and rejected for any other reason, the system SHALL resync the sidebar to match the actual bookmark tree instead of leaving the optimistic UI state stale.

#### Scenario: Dragging a folder onto another reparents it
- **WHEN** the user drags a folder row and drops it onto another folder row in the sidebar
- **THEN** the dragged folder becomes a child of the target folder via the bookmarks API

#### Scenario: Nested contents keep their stored positions
- **WHEN** a folder containing bookmarks and subfolders is moved to a new parent
- **THEN** the stored canvas positions of its bookmarks and subfolders remain unchanged

#### Scenario: Dropping a folder onto its own descendant is rejected
- **WHEN** the user drags a folder row and drops it onto one of that folder's own descendant folders
- **THEN** the drop is rejected without calling the bookmarks API and the folder remains in its original position

#### Scenario: Dragging a protected root folder is rejected
- **WHEN** the user attempts to drag a protected root folder (e.g. Bookmarks Bar or Other Bookmarks)
- **THEN** the drop is rejected without calling the bookmarks API

#### Scenario: A rejected move resyncs the sidebar
- **WHEN** a folder move is attempted and `chrome.bookmarks.move` rejects it
- **THEN** the sidebar resyncs to reflect the actual current bookmark tree instead of retaining the optimistic drag result

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

### Requirement: Sidebar Resizing
The system SHALL allow the user to resize the sidebar by dragging a handle on the sidebar's right border, enforcing a minimum sidebar width of 40px and a maximum sidebar width that scales with the browser window's viewport width — 212px below a 1024px viewport width, 512px from 1024px up to (but not including) 1920px, and 1024px at 1920px and above — and SHALL persist the user's chosen width as their preference across sessions, independent of whichever tier cap is active when it's read. The system SHALL NOT modify the canvas's scrolling configuration as part of this requirement.

#### Scenario: Dragging the right border resizes the sidebar
- **WHEN** the user presses down on the sidebar's right border and drags it to the right or to the left
- **THEN** the sidebar's width increases or decreases to follow the cursor

#### Scenario: Sidebar cannot shrink below the minimum width
- **WHEN** the user drags the sidebar's right border further left than the point where the sidebar would be narrower than 40px
- **THEN** the sidebar's width stops at 40px and does not shrink further

#### Scenario: Sidebar cannot grow beyond the current tier's maximum width
- **WHEN** the user drags the sidebar's right border further right than the maximum width allowed for the current viewport tier
- **THEN** the sidebar's width stops at that tier's maximum and does not grow further

#### Scenario: Resizing on a small or medium screen caps at 212px
- **WHEN** the browser window's viewport width is below 1024px and the user drags the sidebar wider than 212px
- **THEN** the sidebar's width stops at 212px

#### Scenario: Resizing on a large screen caps at 512px
- **WHEN** the browser window's viewport width is at least 1024px and below 1920px and the user drags the sidebar wider than 512px
- **THEN** the sidebar's width stops at 512px

#### Scenario: Resizing on an ultra-large screen caps at 1024px
- **WHEN** the browser window's viewport width is at least 1920px and the user drags the sidebar wider than 1024px
- **THEN** the sidebar's width stops at 1024px

#### Scenario: Shrinking the window re-clamps a wider sidebar live
- **WHEN** the sidebar's current width exceeds the maximum for its viewport tier because the browser window was resized narrower
- **THEN** the sidebar's width immediately shrinks to that tier's maximum, without requiring the user to drag the handle

#### Scenario: Growing the window back out restores the user's preferred width
- **WHEN** the browser window is resized wider after a live re-clamp shrank the sidebar, into a tier whose maximum is at least the user's last explicitly chosen width
- **THEN** the sidebar's width grows back to that previously chosen width rather than remaining at the smaller tier's maximum

#### Scenario: Cursor changes on hover over the resize border
- **WHEN** the user hovers the pointer over the sidebar's right border, whether or not a drag is in progress
- **THEN** the cursor icon changes to a horizontal resize indicator

#### Scenario: Resized width persists across sessions
- **WHEN** the user resizes the sidebar and then reloads or reopens the new-tab page
- **THEN** the sidebar renders at the previously chosen width instead of the default width, clamped to the current viewport tier's maximum if needed

### Requirement: Sidebar Hides Native Scroll Controls
The system SHALL hide the sidebar's native horizontal and vertical scrollbar controls while keeping the sidebar's content scrollable by other input methods (e.g. wheel, trackpad, keyboard).

#### Scenario: No visible scrollbar on a tall folder tree
- **WHEN** the sidebar's folder tree content is taller than the sidebar's visible area
- **THEN** no native vertical scrollbar track or thumb is rendered, but the content can still be scrolled with the wheel or trackpad

#### Scenario: No visible scrollbar on a narrow sidebar
- **WHEN** the sidebar is resized narrow enough that its content would overflow horizontally
- **THEN** no native horizontal scrollbar track or thumb is rendered

