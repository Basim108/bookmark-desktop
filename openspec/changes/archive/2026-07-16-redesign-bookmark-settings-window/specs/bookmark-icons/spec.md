## MODIFIED Requirements

### Requirement: Custom Icon Upload
The system SHALL allow the user to upload a local image file as a bookmark's
custom icon, replacing the favicon display. Accepted formats SHALL be limited to
PNG, JPEG/JPG, WebP, and AVIF; SVG SHALL NOT be accepted. When the upload is
performed inside the Edit Bookmark window, the selected image SHALL be validated
and shown as a preview but SHALL NOT be persisted as the bookmark's custom icon
until the user saves; discarding the window without saving SHALL leave the
bookmark's existing icon unchanged.

#### Scenario: Uploading a supported format sets the custom icon
- **WHEN** the user uploads a PNG, JPEG, WebP, or AVIF file as a bookmark's icon and saves
- **THEN** that image replaces the favicon as the bookmark's displayed icon

#### Scenario: Uploading SVG is rejected
- **WHEN** the user attempts to upload an SVG file as a bookmark's icon
- **THEN** the system rejects the upload and the format is not accepted

#### Scenario: Staged upload is discarded without saving
- **WHEN** the user selects a new image in the Edit Bookmark window and closes it without saving
- **THEN** the bookmark's previously displayed icon is unchanged and the selected image is not stored

### Requirement: Custom Icon Removal
The system SHALL allow the user to remove a bookmark's custom icon, reverting its
display to the favicon. When the removal is performed inside the Edit Bookmark
window, it SHALL be staged and take effect only on save; the remove-image control
SHALL be offered only while the bookmark currently has a custom icon.

#### Scenario: Removing a custom icon reverts to favicon
- **WHEN** the user removes a bookmark's custom icon and saves
- **THEN** the bookmark's icon display reverts to its URL's favicon

#### Scenario: Remove-image control hidden without a custom icon
- **WHEN** the Edit Bookmark window is open for a bookmark that has no custom icon
- **THEN** no remove-image control is shown

#### Scenario: Staged removal is discarded without saving
- **WHEN** the user removes the custom image in the Edit Bookmark window and closes it without saving
- **THEN** the bookmark's custom icon is unchanged
