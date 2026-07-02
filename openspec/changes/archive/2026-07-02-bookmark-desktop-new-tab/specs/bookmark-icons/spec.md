## ADDED Requirements

### Requirement: Default Favicon Icon
The system SHALL display a bookmark's favicon as its icon by default, including when only a small native favicon size is available.

#### Scenario: Bookmark displays its favicon by default
- **WHEN** a bookmark has no custom icon set
- **THEN** its icon is rendered from its URL's favicon, even if only a small size is available

### Requirement: Custom Icon Upload
The system SHALL allow the user to upload a local image file as a bookmark's custom icon, replacing the favicon display. Accepted formats SHALL be limited to PNG, JPEG/JPG, WebP, and AVIF; SVG SHALL NOT be accepted.

#### Scenario: Uploading a supported format sets the custom icon
- **WHEN** the user uploads a PNG, JPEG, WebP, or AVIF file as a bookmark's icon
- **THEN** that image replaces the favicon as the bookmark's displayed icon

#### Scenario: Uploading SVG is rejected
- **WHEN** the user attempts to upload an SVG file as a bookmark's icon
- **THEN** the system rejects the upload and the format is not accepted

### Requirement: Custom Icon Removal
The system SHALL allow the user to remove a bookmark's custom icon, reverting its display to the favicon.

#### Scenario: Removing a custom icon reverts to favicon
- **WHEN** the user removes a bookmark's custom icon
- **THEN** the bookmark's icon display reverts to its URL's favicon

### Requirement: Generic Fallback Icon
The system SHALL display a generic fallback icon for a bookmark that has no custom icon and whose favicon cannot be resolved.

#### Scenario: No custom icon and no resolvable favicon
- **WHEN** a bookmark has no custom icon set and its favicon cannot be resolved
- **THEN** the system displays a generic fallback icon in its place

### Requirement: Upload File Type Validation
The system SHALL validate an uploaded icon file's actual format by inspecting its file signature (magic bytes) rather than trusting its file extension or claimed MIME type, and SHALL reject files whose actual content does not match an accepted format.

#### Scenario: File with mismatched signature is rejected
- **WHEN** an uploaded file's actual byte signature does not correspond to an accepted image format, regardless of its file extension or claimed MIME type
- **THEN** the system rejects the upload

### Requirement: Upload Size and Dimension Limits
The system SHALL enforce a configured maximum file size and maximum pixel dimensions on uploaded icon images, rejecting uploads that exceed either limit.

#### Scenario: Oversized upload is rejected
- **WHEN** an uploaded icon file exceeds the configured maximum file size or maximum pixel dimensions
- **THEN** the system rejects the upload

### Requirement: Safe Image Rendering
The system SHALL render all custom icon images via an `<img>` element or blob URL, and SHALL NOT parse or inline uploaded image content as markup.

#### Scenario: Custom icon rendered as image source, not inline markup
- **WHEN** a bookmark's custom icon is displayed
- **THEN** it is rendered via an image element/blob source and its file content is never parsed or injected as inline DOM markup
