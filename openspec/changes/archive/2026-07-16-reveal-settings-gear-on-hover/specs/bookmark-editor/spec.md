## ADDED Requirements

### Requirement: Edit Trigger Hidden Until Cell Hover Or Focus

The per-bookmark edit trigger (settings gear) on the canvas SHALL be visually hidden at rest and SHALL be revealed only while the mouse hovers the bookmark's occupied grid cell or the trigger itself receives keyboard focus. The trigger SHALL remain present in the DOM and reachable by keyboard at all times, and revealing or hiding it SHALL NOT change the cell's layout or shift its icon or label. Activating the trigger SHALL open the Edit Bookmark window exactly as before, with no change to its click behavior.

#### Scenario: Gear hidden while cell is at rest

- **WHEN** a bookmark's grid cell is neither hovered nor keyboard-focused
- **THEN** its edit trigger (settings gear) is not visually shown

#### Scenario: Gear revealed on cell hover

- **WHEN** the mouse hovers over the bookmark's occupied grid cell
- **THEN** its edit trigger (settings gear) becomes visible without shifting the cell's icon or label

#### Scenario: Gear revealed on keyboard focus

- **WHEN** the edit trigger receives keyboard focus (e.g. via Tab) while its cell is not hovered
- **THEN** the trigger becomes visible so a keyboard user can see and activate it

#### Scenario: Activation behavior unchanged

- **WHEN** the user activates the revealed edit trigger
- **THEN** the Edit Bookmark window opens for that bookmark exactly as it did when the trigger was always visible
