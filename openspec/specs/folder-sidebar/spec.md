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

### Requirement: Folder Label Font Size Follows Grid Tier
The system SHALL render folder row names at a font-size that matches the canvas grid's current tier — 0.75rem when the grid is at its 80px tier, 0.85rem at its 106px tier, and 1rem at its 166px tier — independent of the sidebar's own separate width-tiering system.

#### Scenario: Folder label matches the grid's smallest tier
- **WHEN** the canvas grid is at its 80px tier
- **THEN** folder row names render at 0.75rem

#### Scenario: Folder label matches the grid's middle tier
- **WHEN** the canvas grid is at its 106px tier
- **THEN** folder row names render at 0.85rem

#### Scenario: Folder label matches the grid's largest tier
- **WHEN** the canvas grid is at its 166px tier
- **THEN** folder row names render at 1rem

#### Scenario: Folder label size is unaffected by sidebar width
- **WHEN** the user resizes the sidebar without changing the canvas grid's tier
- **THEN** folder row label font-size does not change

### Requirement: Folder Row Icon and Label Alignment
When a folder's sidebar row displays both its icon and name, the system SHALL lay them out on a single line, with the name following the icon, vertically centered relative to each other, separated by approximately 3px of spacing.

#### Scenario: Icon and name sit on one line
- **WHEN** a folder's sidebar row is set to display both icon and name
- **THEN** the icon and name render side by side on a single line, not stacked

#### Scenario: Icon and name are vertically centered
- **WHEN** a folder's sidebar row displays both icon and name
- **THEN** the icon and name are vertically centered relative to each other within the row

#### Scenario: Small gap between icon and name
- **WHEN** a folder's sidebar row displays both icon and name
- **THEN** approximately 3px of spacing separates the icon from the name

### Requirement: Folder Row Single-Line Layout Without List Markers
The system SHALL render each folder row's expand-toggle, icon+name area, and settings button on a single horizontal line, vertically centered relative to each other, and SHALL NOT display any native list bullet marker before a row.

#### Scenario: Expand-toggle, icon+name, and settings button share one line
- **WHEN** a folder row renders, whether or not the folder has children
- **THEN** the expand-toggle (or its spacer), the icon+name area, and the settings button all appear on the same horizontal line

#### Scenario: Row elements are vertically centered
- **WHEN** a folder row renders
- **THEN** the expand-toggle, icon+name area, and settings button are vertically centered relative to each other within the row

#### Scenario: No bullet marker before a row
- **WHEN** the folder tree or any expanded subfolder list renders
- **THEN** no list bullet or other native list marker appears before any row

#### Scenario: Rows with and without children align identically
- **WHEN** comparing a folder row that has subfolders (showing an expand-toggle) to one that does not (showing a spacer)
- **THEN** the icon+name area starts at the same horizontal position in both rows

### Requirement: Folder Row Hover Affordance
The system SHALL render each folder row with a single transparent-at-rest background covering its entire row — expand-toggle, icon, name, and settings button together — SHALL highlight that full row (same background) on mouse hover and while a drag is over it, SHALL show a pointer cursor while hovering it at rest, and SHALL show a grabbing cursor while the folder row is being actively dragged. The system SHALL also apply that same highlight persistently to whichever folder is currently active/selected, independent of hover or drag state.

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

#### Scenario: The active folder shows a persistent highlight
- **WHEN** a folder is the currently active/selected folder shown on the canvas
- **THEN** that folder's row shows the same highlight as hover, persistently, regardless of mouse position

#### Scenario: Rows are transparent at rest
- **WHEN** a folder row is neither hovered, drag-targeted, nor the active folder
- **THEN** its background is transparent

### Requirement: Folder Row Edge Spacing
The system SHALL render each folder row with approximately 3px of spacing on its top, bottom, and right edges, so its settings button does not touch the sidebar's border and adjacent rows do not touch each other. Left-edge spacing SHALL continue to be governed solely by the row's existing per-depth indentation.

#### Scenario: Settings button does not touch the sidebar border
- **WHEN** a folder row renders
- **THEN** its settings button is visually separated from the sidebar's right border by approximately 3px

#### Scenario: Adjacent rows do not touch
- **WHEN** two folder rows are stacked directly above one another
- **THEN** approximately 3px of vertical spacing separates them

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

### Requirement: Sidebar Header With General Settings Button
The system SHALL render a header band at the top of the sidebar, above and outside the scrollable folder tree area, so it remains fixed while the folder tree scrolls. The header SHALL contain a settings button rendered as three horizontal lines (a hamburger glyph) pinned to the header's top-right corner. Clicking the button SHALL open the General Settings window. The header SHALL NOT be a folder row: it SHALL NOT appear within the folder tree, SHALL NOT carry a folder name, icon, or expand toggle, and SHALL NOT participate in folder selection, drag, or drop.

#### Scenario: Header stays fixed while the folder tree scrolls
- **WHEN** the folder tree content is taller than the sidebar's visible area and the user scrolls it
- **THEN** the sidebar header and its hamburger button remain fixed in place and do not scroll away

#### Scenario: Hamburger button opens General Settings
- **WHEN** the user clicks the sidebar header's hamburger button
- **THEN** the General Settings window opens

#### Scenario: Header is not a folder row
- **WHEN** the sidebar header renders
- **THEN** it appears outside the folder tree and does not show a folder name, folder icon, or expand toggle, and it is not selectable, draggable, or a drop target

#### Scenario: Hamburger button sits in the top-right corner
- **WHEN** the sidebar header renders
- **THEN** the hamburger button is positioned at the header's top-right corner

### Requirement: Folder Settings Toggle Hidden Until Row Hover Or Focus

A folder row's settings (gear) toggle button SHALL be visually hidden at rest and SHALL be revealed only while the mouse hovers the folder row or the toggle itself receives keyboard focus, and SHALL remain revealed while that folder's settings window is open. The toggle SHALL remain present in the DOM and reachable by keyboard at all times, and revealing or hiding it SHALL NOT change the folder row's layout or shift its expand-toggle, icon, or name. Activating the toggle SHALL open the folder's settings window exactly as before, with no change to its click behavior. This requirement applies only to non-root folders; root folders continue to render no settings toggle at all.

#### Scenario: Gear hidden while row is at rest

- **WHEN** a non-root folder row is neither hovered nor keyboard-focused and its settings window is closed
- **THEN** its settings (gear) toggle is not visually shown

#### Scenario: Gear revealed on row hover

- **WHEN** the mouse hovers over any part of a non-root folder's row
- **THEN** its settings (gear) toggle becomes visible without shifting the row's expand-toggle, icon, or name

#### Scenario: Gear revealed on keyboard focus

- **WHEN** the settings toggle receives keyboard focus (e.g. via Tab) while its row is not hovered
- **THEN** the toggle becomes visible so a keyboard user can see and activate it

#### Scenario: Gear stays visible while settings window is open

- **WHEN** a folder's settings window is open
- **THEN** that folder's settings toggle remains visible even if the mouse leaves the row

#### Scenario: Root folders unaffected

- **WHEN** a root folder row is rendered
- **THEN** it displays no settings toggle regardless of hover or focus, unchanged from before

#### Scenario: Activation behavior unchanged

- **WHEN** the user activates the revealed settings toggle
- **THEN** the folder's settings window opens exactly as it did when the toggle was always visible

### Requirement: Import Bookmarks Control in Folder Settings
The Folder Settings window SHALL provide an "Import Bookmarks" dropdown control
whose items each start an import into the folder that window is open on. The
dropdown SHALL contain a single item, "Import uTab", which SHALL open the
operating system's file picker restricted to JSON files so the user can choose a
uTab export from their local machine. The chosen file SHALL be read locally and
SHALL NOT be transmitted off-device. After the import runs, the window SHALL
show its result (a success summary or an error) to the user.

#### Scenario: Import Bookmarks dropdown is available in Folder Settings
- **WHEN** the Folder Settings window is open for a folder
- **THEN** it displays an "Import Bookmarks" dropdown containing an "Import uTab" item

#### Scenario: Import uTab opens a local file picker
- **WHEN** the user selects "Import uTab" from the dropdown
- **THEN** the operating system's file picker opens for choosing a JSON file from the local machine

#### Scenario: Import targets the current folder
- **WHEN** the user completes an import from a folder's settings window
- **THEN** the imported folders and bookmarks are created inside that folder

#### Scenario: Import result is shown in the window
- **WHEN** an import started from the Folder Settings window finishes
- **THEN** the window shows the import's result — a summary of what was imported and skipped, or an error if the file was rejected

