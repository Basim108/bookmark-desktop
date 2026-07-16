# bookmark-editor Specification

## Purpose
The centered "Edit Bookmark" window: a single, opaque, viewport-centered surface for editing one bookmark's icon, name, URL, and label visibility, and for removing it. All edits are staged and applied atomically on Save; closing the window without saving discards them.
## Requirements
### Requirement: Bookmark Edit Window Presentation
The system SHALL present per-bookmark editing in a single window that is horizontally and vertically centered within the browser window, rendered above all page content with a fully opaque (non-transparent) background. The window SHALL have a title bar containing the title "Edit Bookmark" and a close control in the top-right corner sized large enough to be an easy click target. The window's overall size and the spacing between its internal components SHALL follow the reference design (`design/examples/05-general-bookmark-settings-window.png`): an approximately 440px-wide window with a title bar, an icon preview with an adjacent image-upload action, editable Name and URL fields, a label-visibility control, and a bottom row containing a Remove action and a Save action.

#### Scenario: Window is centered and opaque
- **WHEN** the Edit Bookmark window is open
- **THEN** it is centered in the browser window, has a non-transparent background, and is painted above the canvas and sidebar content

#### Scenario: Title bar shows title and close control
- **WHEN** the Edit Bookmark window is open
- **THEN** its title bar displays "Edit Bookmark" and a close (✕) control in the top-right corner

#### Scenario: No Cancel button
- **WHEN** the Edit Bookmark window is open
- **THEN** the bottom row contains a Remove action and a Save action and does not contain a Cancel button

### Requirement: Bookmark Edit Window Open Trigger
The system SHALL provide a per-bookmark control on the canvas that opens the Edit Bookmark window for that bookmark.

#### Scenario: Opening the window for a bookmark
- **WHEN** the user activates a bookmark's edit trigger on the canvas
- **THEN** the Edit Bookmark window opens for that bookmark, pre-filled with its current icon, name, URL, and label-visibility setting

### Requirement: Bookmark Name Editing
The system SHALL allow the user to edit a bookmark's name within the Edit Bookmark window and persist the new name to the bookmark on save. A name that is empty or consists only of whitespace SHALL be rejected.

#### Scenario: Editing and saving a name
- **WHEN** the user changes the Name field and clicks Save
- **THEN** the bookmark's title is updated to the new name

#### Scenario: Empty or whitespace-only name rejected
- **WHEN** the user attempts to save a name that is empty or contains only whitespace
- **THEN** the system rejects the change and the bookmark's title is not updated

### Requirement: Bookmark URL Editing
The system SHALL allow the user to edit a bookmark's URL within the Edit Bookmark window and persist the new URL to the bookmark on save. The system SHALL validate the edited URL against the same safe-scheme allowlist used for navigation and SHALL reject saving a URL whose scheme is not on that allowlist.

#### Scenario: Editing and saving a valid URL
- **WHEN** the user changes the URL field to a URL whose scheme is on the safe allowlist and clicks Save
- **THEN** the bookmark's URL is updated to the new value

#### Scenario: Unsafe URL scheme rejected
- **WHEN** the user attempts to save a URL whose scheme is not on the safe allowlist (e.g. `javascript:`, `data:`)
- **THEN** the system rejects the change and the bookmark's URL is not updated

### Requirement: Deferred Save of Bookmark Edits
The system SHALL stage all edits made in the Edit Bookmark window — name, URL, custom image (upload or removal), and label visibility — and SHALL apply none of them until the user clicks Save. When the user clicks Save, the system SHALL apply all staged edits and then close the window. When the user closes the window without saving (via the close control, the backdrop, or the Escape key), the system SHALL discard all staged edits and apply none of them.

#### Scenario: Save applies all staged edits
- **WHEN** the user has changed one or more of the name, URL, image, or label visibility and clicks Save
- **THEN** all of those changes are applied and the window closes

#### Scenario: Closing without saving discards edits
- **WHEN** the user has changed one or more fields and closes the window via the close control, the backdrop, or the Escape key
- **THEN** none of those changes are applied and the window closes

#### Scenario: Staged image is not persisted before save
- **WHEN** the user selects a new image in the window but has not yet clicked Save
- **THEN** the image is shown as a preview but is not written to persistent storage

### Requirement: Bookmark Removal From Window
The system SHALL provide a Remove action in the Edit Bookmark window that, after a confirmation step, deletes the bookmark from Chrome's bookmarks and closes the window. Deleting the bookmark SHALL remove it from the canvas, from its folder, and from Chrome's bookmark store, and the canvas and sidebar SHALL reflect the removal without a manual reload.

#### Scenario: Remove requires confirmation
- **WHEN** the user clicks Remove
- **THEN** the system requests confirmation before deleting the bookmark

#### Scenario: Confirmed removal deletes and closes
- **WHEN** the user confirms removal
- **THEN** the bookmark is deleted from Chrome's bookmarks, disappears from the canvas and folder, and the window closes

#### Scenario: Removal cleans up stored bookmark data
- **WHEN** a bookmark is removed via the Edit Bookmark window
- **THEN** its stored position, settings, and any custom icon image are cleaned up (via the existing removal cascade)

### Requirement: Edit Trigger Hidden Until Cell Hover Or Focus

The per-bookmark edit trigger (settings gear) on the canvas SHALL be visually hidden at rest and SHALL be revealed only while the mouse hovers the bookmark's occupied grid cell or the trigger itself receives keyboard focus. The trigger SHALL remain present in the DOM and reachable by keyboard at all times, and revealing or hiding it SHALL NOT change the cell's layout or shift its icon or label. Activating the trigger SHALL open the Edit Bookmark window exactly as before, with no change to its click behavior.

#### Scenario: Gear hidden while cell is at rest

- **WHEN** a bookmark's grid cell is neither hovered nor keyboard-focused
- **THEN** its edit trigger (settings gear) is not visually shown

#### Scenario: Gear revealed on cell hover

- **WHEN** the mouse hovers over the bookmark's occupied grid cell
- **THEN** its edit trigger (settings gear) becomes visible without shifting the cell's icon or label

#### Scenario: Gear revealed on keyboard focus

- **WHEN** the edit trigger receives keyboard focus (e.g. via Tab) while its cell is not hovered
- **THEN** the trigger becomes visible so a keyboard user can see and activate it

#### Scenario: Activation behavior unchanged

- **WHEN** the user activates the revealed edit trigger
- **THEN** the Edit Bookmark window opens for that bookmark exactly as it did when the trigger was always visible

