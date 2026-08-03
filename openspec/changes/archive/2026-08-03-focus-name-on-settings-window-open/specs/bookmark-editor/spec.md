## ADDED Requirements

### Requirement: Edit Bookmark Window Focuses Its Name Field
When the Edit Bookmark window opens, the system SHALL place keyboard focus in
its `Name` field.

The system SHALL NOT select the field's existing contents. The first keystroke
SHALL extend the bookmark's existing name rather than replace it, and the
insertion point SHALL be positioned after the existing text.

Renaming is the most common reason to open this window; without focus it costs a
click first, and a keyboard-only user must tab past the window's other controls
to reach the field. Leaving the value unselected keeps that saving without
making replacement automatic — the field is always pre-filled with the
bookmark's current title, so a selected value would be one keystroke from gone.

Focus SHALL be placed once, when the window opens, and SHALL NOT be re-asserted
while it remains open.

This requirement governs where focus *starts*. It does not confine focus to the
window, and it does not restore focus when the window closes.

#### Scenario: Focus lands in the Name field
- **WHEN** the Edit Bookmark window opens
- **THEN** its Name field has keyboard focus

#### Scenario: The existing name is not selected, so typing extends it
- **WHEN** the Edit Bookmark window opens and the user immediately types
- **THEN** what they type is added to the bookmark's existing name rather than replacing it

#### Scenario: The insertion point follows the existing name
- **WHEN** the Edit Bookmark window opens
- **THEN** nothing in the Name field is highlighted and the insertion point sits after the last character

#### Scenario: The URL field is left alone
- **WHEN** the Edit Bookmark window opens
- **THEN** the URL field is neither focused nor selected, and its value is unchanged
