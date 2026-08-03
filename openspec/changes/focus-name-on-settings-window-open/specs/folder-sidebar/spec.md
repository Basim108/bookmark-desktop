## ADDED Requirements

### Requirement: Folder Settings Window Focuses Its Name Field
When the folder settings window opens — whether editing an existing folder or
drafting a new one — the system SHALL place keyboard focus in its `Name` field.

The system SHALL NOT select the field's existing contents. The first keystroke
SHALL extend the existing name rather than replace it, and the insertion point
SHALL be positioned after the existing text.

Renaming is the most common reason to open this window, and focus otherwise
stays wherever it was: every rename costs a click before a keystroke, and a
keyboard-only user has to tab past the window's other controls to reach the
field. Leaving the value unselected keeps the cheap action cheap without making
the destructive one automatic — a selected name is one keystroke from being
wiped, and these windows are opened to adjust a name at least as often as to
replace it wholesale.

Focus SHALL be placed once, when the window opens, and SHALL NOT be re-asserted
while it remains open. This window re-renders continuously while an import it
launched reports progress, and re-focusing on each render would pull the caret
out of the field mid-typing.

This requirement governs where focus *starts*. It does not confine focus to the
window, and it does not restore focus when the window closes.

#### Scenario: Focus lands in the Name field for an existing folder
- **WHEN** the folder settings window opens for an existing folder
- **THEN** its Name field has keyboard focus

#### Scenario: An existing name is not selected, so typing extends it
- **WHEN** the folder settings window opens for a folder that has a name, and the user immediately types
- **THEN** what they type is added to the existing name rather than replacing it

#### Scenario: The insertion point follows the existing name
- **WHEN** the folder settings window opens for a folder that has a name
- **THEN** nothing in the field is highlighted and the insertion point sits after the last character

#### Scenario: The New Folder draft is focused with nothing to select
- **WHEN** the New Folder draft window opens
- **THEN** its empty Name field has keyboard focus and the user can type immediately

#### Scenario: Focus is not re-asserted while the window stays open
- **WHEN** the window re-renders while it remains open — for example while an import it launched reports progress — and the user has moved focus elsewhere within it
- **THEN** focus is left where the user put it
