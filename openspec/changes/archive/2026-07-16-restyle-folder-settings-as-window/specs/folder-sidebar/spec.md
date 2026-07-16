## MODIFIED Requirements

### Requirement: Folder Sidebar Display Setting
The system SHALL allow each folder to independently configure its sidebar row display as icon-only, label-only, or both icon and label, rename the folder, upload or remove a custom folder image, and remove the folder, with no inheritance from other folders, presented in a centered modal window matching the Edit Bookmark window's style (titlebar with title and close control, opaque body, and a footer) rather than as a popup anchored to the folder's settings toggle button. The modal window SHALL be opened from the folder's settings (gear) toggle button, whose glyph SHALL render at a 16px font size, and SHALL float over the center of the viewport without shifting sibling or descendant folder rows. The icon display options SHALL be unavailable until the folder has a custom uploaded image, evaluated against the window's staged (not-yet-saved) image state. Folder names SHALL NOT be empty or consist only of whitespace. All edits (name, display mode, custom image) SHALL be staged in the window and applied together only when the user saves; closing the window, pressing the Escape key, or clicking the backdrop SHALL discard any unsaved edits. Only one folder's settings window SHALL be open at a time. When the window has a staged custom image (either the folder's existing image or a newly uploaded one), it SHALL display a fixed-size preview of that image matching the Edit Bookmark window's preview sizing; when no image is staged it SHALL display no image preview. Removing the folder SHALL delete the folder and its entire subtree. When a folder's sidebar row displays its custom icon (icon-only or icon+label mode), the row's icon SHALL be sized according to the browser window's viewport width — 24px below 1024px and 32px at 1024px and above — independent of and unaffected by the settings window's fixed preview sizing.

#### Scenario: Settings open as a centered modal window, not an anchored popup
- **WHEN** the user clicks a folder's settings (gear) toggle button
- **THEN** a centered modal window styled like the Edit Bookmark window opens, and sibling and descendant folder rows do not shift position

#### Scenario: Gear toggle button renders at 16px
- **WHEN** a folder row's settings (gear) toggle button renders
- **THEN** its glyph is displayed at a 16px font size

#### Scenario: Icon display unavailable without a staged custom image
- **WHEN** the folder settings window has no staged custom image
- **THEN** the icon-only and icon+label display options are disabled

#### Scenario: Icon display available with a staged custom image
- **WHEN** the folder settings window has a staged custom image (existing or newly uploaded)
- **THEN** the user can select icon-only, label-only, or icon+label display

#### Scenario: Empty or whitespace-only folder name rejected
- **WHEN** the user attempts to save a folder name that is empty or contains only whitespace
- **THEN** the system rejects the change and does not save

#### Scenario: Edits are staged and applied only on save
- **WHEN** the user changes the name, display mode, or custom image in the window and clicks Save
- **THEN** all changed values are applied together, and not before Save is clicked

#### Scenario: Closing the window discards unsaved edits
- **WHEN** the folder settings window has unsaved edits and the user closes it, presses Escape, or clicks the backdrop
- **THEN** the window closes and none of the staged edits are applied

#### Scenario: Staging an image removal falls back to label-only on save
- **WHEN** an icon-requiring display mode is selected and the user stages removal of the folder's custom image, then saves
- **THEN** the folder's display mode is saved as label-only without error

#### Scenario: Renaming the folder updates its title
- **WHEN** the user edits the name to a non-empty value and saves
- **THEN** the folder's title is updated via the bookmarks API

#### Scenario: Removing the folder deletes it and its subtree
- **WHEN** the user confirms removal of the folder in the window
- **THEN** the folder and all of its nested bookmarks and subfolders are deleted, and their stored positions, settings, and custom-icon data are discarded

#### Scenario: Only one folder settings window is open at a time
- **WHEN** a folder's settings window is open and the user opens a different folder's settings
- **THEN** the first window closes and the newly selected folder's window opens

#### Scenario: Image preview appears only when an image is staged
- **WHEN** the folder settings window is open
- **THEN** it displays a fixed-size preview of the staged custom image when one is staged, and no image preview when none is staged

#### Scenario: Sidebar row icon sized 24px on small screens
- **WHEN** a folder's sidebar row displays its custom icon and the browser window's viewport width is below 1024px
- **THEN** the row's icon renders at 24px

#### Scenario: Sidebar row icon sized 32px at and above the breakpoint
- **WHEN** a folder's sidebar row displays its custom icon and the browser window's viewport width is at least 1024px
- **THEN** the row's icon renders at 32px

#### Scenario: Sidebar row icon size is independent of the settings window preview
- **WHEN** a folder's sidebar row displays its custom icon
- **THEN** the row's icon renders at its viewport-tiered size (24px or 32px), not the fixed 64px used by the settings window's preview
