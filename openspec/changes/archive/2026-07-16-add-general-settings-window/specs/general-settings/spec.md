## ADDED Requirements

### Requirement: General Settings Window
The system SHALL provide a global "Settings" window, opened from the sidebar's header hamburger button, presented as a centered modal window matching the Edit Bookmark and Folder Settings windows' style — a titlebar containing the title "Settings" and a close (✕) control in the top-right corner, an opaque body, and a footer containing a Save button. The window SHALL float over the center of the viewport (portaled to the document body) and SHALL NOT be tied to any single folder or bookmark. Closing the window via the close control, pressing the Escape key, or clicking the backdrop SHALL discard any unsaved edits. Only one General Settings window SHALL be open at a time.

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
The system SHALL apply the configured background image to the canvas area only — not the sidebar and not the whole window — rendered without repeating, positioned centered, and sized according to the chosen fit mode: cover fills and crops the canvas, contain fits the whole image within the canvas, and center displays the image at its natural size centered. When no background is set, the canvas SHALL render with no background image. Background changes SHALL propagate live to every open new-tab page in the same browser profile without a manual reload.

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
