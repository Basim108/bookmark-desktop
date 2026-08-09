## ADDED Requirements

### Requirement: About Control in the General Settings Window

The General Settings window SHALL contain an "About" control that opens the
release-notice window, so the extension's version and the notes for it remain
reachable at any time rather than only in the moments after an update.

The release-notice window SHALL open **stacked above** the General Settings
window, which SHALL remain open beneath it with its staged, unsaved edits
intact. Opening or closing the release-notice window SHALL NOT save, discard, or
otherwise disturb those staged edits.

While the release-notice window is stacked above it, the Escape key and a click
on the backdrop SHALL dismiss only the topmost window — the release-notice
window — leaving the General Settings window open. Once the release-notice
window is closed, the Escape key and the backdrop SHALL dismiss the General
Settings window as they normally do.

The General Settings window's existing rule that it cannot be dismissed while a
transfer operation it started is running SHALL continue to apply unchanged.

#### Scenario: About opens the release-notice window
- **WHEN** the user clicks the About control in the General Settings window
- **THEN** the release-notice window opens above it, showing the extension's version and the current version's notes

#### Scenario: The settings window stays open beneath
- **WHEN** the release-notice window is opened from the About control
- **THEN** the General Settings window remains open beneath it

#### Scenario: Staged edits survive
- **WHEN** the user has staged an unsaved edit, opens the release-notice window from About, and closes it
- **THEN** the staged edit is still staged and has been neither saved nor discarded

#### Scenario: Escape dismisses only the topmost window
- **WHEN** the release-notice window is stacked above the General Settings window and the user presses the Escape key
- **THEN** the release-notice window closes and the General Settings window remains open

#### Scenario: The backdrop dismisses only the topmost window
- **WHEN** the release-notice window is stacked above the General Settings window and the user clicks the backdrop
- **THEN** the release-notice window closes and the General Settings window remains open

#### Scenario: Normal dismissal resumes afterwards
- **WHEN** the release-notice window has been closed and the user presses the Escape key
- **THEN** the General Settings window closes, discarding any unsaved edits as it normally does
