# general-settings Specification

## Purpose
Global, page-wide settings for the new-tab page — settings that apply to the
whole desktop rather than to any one folder or bookmark — surfaced in a single
"Settings" window opened from the sidebar. The first such setting is a
configurable canvas background image.

## Requirements
### Requirement: General Settings Window

The system SHALL provide a global "Settings" window, opened from the sidebar's header hamburger button, presented as a centered modal window matching the Edit Bookmark and Folder Settings windows' style — a titlebar containing the title "Settings" and a close (✕) control in the top-right corner, an opaque body, and a footer containing a Save button. The window SHALL float over the center of the viewport (portaled to the document body) and SHALL NOT be tied to any single folder or bookmark. Closing the window via the close control, pressing the Escape key, or clicking the backdrop SHALL discard any unsaved edits. Only one General Settings window SHALL be open at a time.

While a transfer operation the window started is still running, the window SHALL NOT be dismissable — neither by the Escape key, the close control, nor the backdrop. Dismissing it mid-operation would unmount the window while the operation continued in the background, so the user would receive the operation's downloads with no window to explain them and never see its completion summary or the reload prompt that follows it. Dismissal SHALL become available again on any finish path that leaves the window standing — a denial, a cancellation, or a failure. A successful import does not return to that state by design: a clean import reloads the page, and a partial one holds its summary open until acknowledged.

#### Scenario: Opening the window from the header button
- **WHEN** the user clicks the sidebar header's hamburger button
- **THEN** a centered modal window titled "Settings" opens over the viewport

#### Scenario: Window matches the other settings windows' style
- **WHEN** the General Settings window is open
- **THEN** it displays a titlebar with the title "Settings" and a close (✕) control in the top-right corner, an opaque body, and a footer with a Save button

#### Scenario: Close control discards unsaved edits
- **WHEN** the window has unsaved edits and the user clicks the close (✕) control
- **THEN** the window closes and none of the staged edits are applied

#### Scenario: Escape discards unsaved edits
- **WHEN** the window has unsaved edits and the user presses the Escape key
- **THEN** the window closes and none of the staged edits are applied

#### Scenario: Backdrop click discards unsaved edits
- **WHEN** the window has unsaved edits and the user clicks the backdrop outside the window
- **THEN** the window closes and none of the staged edits are applied

#### Scenario: Escape cannot dismiss the window during a running import
- **WHEN** an import is running and the user presses the Escape key
- **THEN** the window stays open, the import continues, and the user still receives its completion summary and reload prompt

#### Scenario: The window cannot be dismissed by any control during a running import
- **WHEN** an import is running and the user clicks the close (✕) control or the backdrop
- **THEN** the window stays open until the operation finishes

#### Scenario: Dismissal is available again once the operation finishes
- **WHEN** a running import finishes on a path that leaves the window standing (denied, cancelled, or failed)
- **THEN** the Escape key, close control, and backdrop dismiss the window normally again

### Requirement: Canvas Background Setting
The system SHALL present, within the General Settings window, a Background setting that lets the user upload an image to use as the canvas background, remove a previously set background, and choose how the image fits — cover, contain, or center — with cover as the default. Uploaded background image bytes SHALL be stored in IndexedDB under a single reserved key that cannot collide with a Chrome bookmark id; the background's presence and fit mode SHALL be stored in chrome.storage.local within an extensible general-settings object. The window SHALL display a preview of the staged background (or a "no background" indication when none is staged). All background edits (uploaded image, removal, fit mode) SHALL be staged in the window and applied together only when the user clicks Save. The fit control SHALL be relevant only when a background image is set.

#### Scenario: Uploading a background image
- **WHEN** the user uploads a valid image in the Background setting and clicks Save
- **THEN** the image is stored as the canvas background and applied to the canvas

#### Scenario: Choosing the fit mode
- **WHEN** the user has a background image staged and selects the cover, contain, or center fit option
- **THEN** that fit mode is staged, and on Save the canvas background is displayed using the chosen fit

#### Scenario: Default fit is cover
- **WHEN** the user uploads a background image without explicitly choosing a fit mode
- **THEN** the fit mode defaults to cover

#### Scenario: Removing the background
- **WHEN** a background image is set and the user removes it and clicks Save
- **THEN** the stored background image is deleted, the general-settings background is set to none, and the canvas shows no background image

#### Scenario: Edits are staged and applied only on Save
- **WHEN** the user uploads, removes, or changes the fit of the background and then closes the window without clicking Save
- **THEN** none of those changes are applied and the canvas background is unchanged

#### Scenario: Preview reflects the staged background
- **WHEN** the Background setting has a staged uploaded image
- **THEN** the window displays a preview of that image; when no background is staged, it indicates no background is set

### Requirement: Canvas Background Application
The system SHALL apply the configured background image to the canvas area only — not the sidebar and not the whole window — rendered without repeating, positioned centered, and sized according to the chosen fit mode: cover fills and crops the canvas, contain fits the whole image within the canvas, and center displays the image at its natural size. When no background is set, the canvas SHALL render with no background image. Background changes SHALL propagate live to every open new-tab page in the same browser profile without a manual reload.

#### Scenario: Background covers the canvas
- **WHEN** a background image is set with the cover fit mode
- **THEN** the canvas background fills the canvas area and is cropped as needed, centered, without repeating

#### Scenario: Background contained within the canvas
- **WHEN** a background image is set with the contain fit mode
- **THEN** the entire background image fits within the canvas area, centered, without repeating

#### Scenario: Background centered at natural size
- **WHEN** a background image is set with the center fit mode
- **THEN** the background image is displayed at its natural size, centered on the canvas, without repeating

#### Scenario: Background does not cover the sidebar
- **WHEN** a canvas background image is set
- **THEN** the image is applied only to the canvas area and the sidebar retains its own background

#### Scenario: No background image when none is set
- **WHEN** the general-settings background is none
- **THEN** the canvas renders without a background image

#### Scenario: Background change syncs across open tabs
- **WHEN** the canvas background is changed in one open new-tab page
- **THEN** every other open new-tab page updates its canvas background without a manual reload

### Requirement: Background Image Upload Validation
The system SHALL validate an uploaded background image by its actual format detected from its byte signature — accepting PNG, JPEG, WebP, and AVIF and rejecting SVG and any other format — and SHALL reject a file larger than 10 MB. Validation SHALL reject a file whose bytes cannot be decoded as an image even when its header matches an accepted format.

#### Scenario: Accepts a supported format within the size limit
- **WHEN** the user uploads a PNG, JPEG, WebP, or AVIF background image that is 10 MB or smaller and decodable
- **THEN** the upload is accepted

#### Scenario: Rejects an unsupported format
- **WHEN** the user uploads a background image whose byte signature is not PNG, JPEG, WebP, or AVIF (for example an SVG)
- **THEN** the upload is rejected

#### Scenario: Rejects a file over the size limit
- **WHEN** the user uploads a background image larger than 10 MB
- **THEN** the upload is rejected

#### Scenario: Rejects an undecodable file
- **WHEN** the user uploads a file whose header matches an accepted format but whose bytes cannot be decoded as an image
- **THEN** the upload is rejected

### Requirement: Export and Import Controls in the General Settings Window
The General Settings window SHALL provide an Export control and an Import control
in its actions footer, left-aligned, with the existing Save control remaining
right-aligned in the same footer. The Export control SHALL export the entire
extension state to a downloaded JSON file. The Import control SHALL open the
operating system's file picker restricted to JSON files so the user can choose a
previously exported file from their local machine; the chosen file SHALL be read
locally and SHALL NOT be transmitted off-device. Export and Import SHALL act
immediately when activated, independently of the Save control (which continues to
apply only the window's staged Background edits).

#### Scenario: Export and Import controls are present in the footer
- **WHEN** the General Settings window is open
- **THEN** its footer shows an Export control and an Import control left-aligned, and the Save control right-aligned

#### Scenario: Export and Import act independently of Save
- **WHEN** the user activates Export or Import
- **THEN** the action runs immediately without requiring the Save control, and Save still applies only the staged Background edits

#### Scenario: Export downloads the state file
- **WHEN** the user activates the Export control
- **THEN** the entire extension state is downloaded as a JSON file named `YYYY-MM-DD-HH-mm-bookmark-desktop.json`

#### Scenario: Import opens a local JSON file picker
- **WHEN** the user activates the Import control
- **THEN** the operating system's file picker opens for choosing a JSON file from the local machine

### Requirement: Custom Backup Confirmation Before Import
When the user chooses a compatible file to import, the system SHALL present a
custom in-app confirmation (not the browser's native OK/Cancel dialog) that warns
the import will replace all current bookmarks and settings and asks whether to
back up first, with three clearly labeled choices: **Yes** (back up the current
state, then import), **No** (import without a backup), and **Cancel** (abort,
changing nothing). The replace SHALL proceed only on Yes or No; Cancel SHALL
leave the extension state unchanged. The confirmation SHALL be presented as a
focused dialog titled "Import Bookmarks", sized to its own content, not stretched
to the dimensions of the settings panel behind it.

#### Scenario: Confirmation uses labeled Yes / No / Cancel choices
- **WHEN** the user chooses a compatible file to import
- **THEN** a custom confirmation appears warning that the import replaces everything, with Yes, No, and Cancel choices

#### Scenario: Confirmation is sized to its content
- **WHEN** the confirmation is shown
- **THEN** it is sized to its own message and buttons rather than stretched to fill the settings panel, with no large empty area

#### Scenario: Import windows are titled "Import Bookmarks"
- **WHEN** the confirmation or the post-import summary is shown
- **THEN** it displays the title "Import Bookmarks"

#### Scenario: Yes backs up then imports
- **WHEN** the user answers Yes to the confirmation
- **THEN** the current state is exported first and then the import proceeds

#### Scenario: No imports without a backup
- **WHEN** the user answers No to the confirmation
- **THEN** the import proceeds and no backup is produced

#### Scenario: Cancel aborts the import
- **WHEN** the user answers Cancel to the confirmation
- **THEN** nothing is deleted or created and the extension state is unchanged

### Requirement: Export and Import Finish on Success
A successful Export SHALL close the General Settings window when it finishes,
behaving like the Save control. A successful Import with no skipped entries SHALL
reload the new-tab page so the fully replaced tree and restored settings render
cleanly with a valid selection (which also dismisses the window). A successful
Import that skipped one or more entries SHALL instead show a summary titled
"Import Bookmarks" telling the user the import completed with issues, how many
entries were skipped, and to consult the downloaded report file by name; the page
SHALL reload only after the user acknowledges the summary (so the message is not
erased by an immediate reload). An Import that is denied before doing any destructive work — because the
chosen file is not parseable JSON or its major version is incompatible — SHALL
keep the window open and show the denial message, so the user learns why nothing
changed.

#### Scenario: Successful export closes the window
- **WHEN** an export finishes downloading the state file
- **THEN** the General Settings window closes

#### Scenario: A clean import reloads the page
- **WHEN** an import completes its replace-and-restore with no skipped entries
- **THEN** the new-tab page reloads, rendering the restored tree and settings

#### Scenario: An import with skipped entries reports before reloading
- **WHEN** an import completes but skipped one or more entries
- **THEN** the user is shown a summary stating the import finished with issues, how many entries were skipped, and to see the downloaded report file, and the page reloads only after the user acknowledges

#### Scenario: A denied import keeps the window open with a message
- **WHEN** an import is denied because the file is not parseable JSON or its major version is incompatible
- **THEN** the window stays open and shows the denial message, and nothing is changed
