## MODIFIED Requirements

### Requirement: Bookmark Edit Window Open Trigger
The system SHALL provide a per-bookmark gear control on the canvas that opens the
bookmark action menu. Activating the `Settings` item in that menu SHALL open the
Edit Bookmark window for that bookmark.

#### Scenario: Opening the window from the bookmark menu
- **WHEN** the user activates a bookmark's gear and then activates Settings
- **THEN** the Edit Bookmark window opens for that bookmark, pre-filled with its current icon, name, URL, and label-visibility setting

### Requirement: Edit Trigger Hidden Until Cell Hover Or Focus

The per-bookmark gear on the canvas SHALL be visually hidden at rest and SHALL
be revealed only while the mouse hovers the bookmark's occupied grid cell, the
gear itself receives keyboard focus, or its action menu is open. The gear SHALL
remain present in the DOM and reachable by keyboard at all times, and revealing
or hiding it SHALL NOT change the cell's layout or shift its icon or label.
Activating the gear SHALL open the bookmark action menu.

#### Scenario: Gear hidden while cell is at rest

- **WHEN** a bookmark's grid cell is neither hovered nor keyboard-focused and its action menu is closed
- **THEN** its gear is not visually shown

#### Scenario: Gear revealed on cell hover

- **WHEN** the mouse hovers over the bookmark's occupied grid cell
- **THEN** its gear becomes visible without shifting the cell's icon or label

#### Scenario: Gear revealed on keyboard focus

- **WHEN** the gear receives keyboard focus while its cell is not hovered
- **THEN** the gear becomes visible so a keyboard user can see and activate it

#### Scenario: Gear remains visible while its menu is open

- **WHEN** the bookmark action menu is open and the pointer leaves the grid cell
- **THEN** the gear remains visible until the menu closes

#### Scenario: Activation opens the action menu

- **WHEN** the user activates the revealed gear
- **THEN** the bookmark action menu opens for that bookmark
