## MODIFIED Requirements

### Requirement: Bookmark URL Editing
The system SHALL allow the user to edit a bookmark's URL within the Edit Bookmark window and persist the new URL to the bookmark on save. The system SHALL validate the edited URL against the same safe-scheme allowlist used for navigation and SHALL reject saving a URL whose scheme is not on that allowlist.

The validation message shown on rejection SHALL name only the schemes that actually work when a bookmark is clicked from the new-tab page. It SHALL NOT advertise `ftp:` (removed from Chrome in version 88) or `file:` (blocked for renderer-initiated navigation from the new-tab page unless the user separately grants file-URL access), because a bookmark saved on the strength of that message would silently do nothing when clicked.

#### Scenario: Editing and saving a valid URL
- **WHEN** the user changes the URL field to a URL whose scheme is on the safe allowlist and clicks Save
- **THEN** the bookmark's URL is updated to the new value

#### Scenario: Unsafe URL scheme rejected
- **WHEN** the user attempts to save a URL whose scheme is not on the safe allowlist (e.g. `javascript:`, `data:`)
- **THEN** the system rejects the change and the bookmark's URL is not updated

#### Scenario: Validation copy names only schemes that work
- **WHEN** the user is shown the invalid-URL message
- **THEN** the message names only the schemes that navigate successfully from the new-tab page, and does not offer `ftp:` or `file:` as valid choices
