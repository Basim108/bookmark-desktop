## MODIFIED Requirements

### Requirement: Per-Bookmark Label Display
The system SHALL allow each bookmark to independently configure whether its name
is shown under its icon or only as a tooltip, defaulting to shown-under-icon,
with no inheritance from its containing folder. This setting SHALL be presented
inside the Edit Bookmark window as a single checkbox: checked means the name is
shown under the icon, and unchecked means the name is shown only as a tooltip
that appears on hover.

#### Scenario: Default label display
- **WHEN** a bookmark has no explicit label-display setting
- **THEN** its name is shown under its icon

#### Scenario: Per-bookmark override does not affect siblings
- **WHEN** the user sets one bookmark's label display to tooltip-only
- **THEN** other bookmarks in the same folder retain their own independent label-display settings

#### Scenario: Label visibility toggled via the window checkbox
- **WHEN** the user unchecks the "show label under icon" checkbox in the Edit Bookmark window and saves
- **THEN** that bookmark's name is no longer shown under its icon and instead appears only as a tooltip on hover
