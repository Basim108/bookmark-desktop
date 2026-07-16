## ADDED Requirements

### Requirement: Folder Settings Toggle Hidden Until Row Hover Or Focus

A folder row's settings (gear) toggle button SHALL be visually hidden at rest and SHALL be revealed only while the mouse hovers the folder row or the toggle itself receives keyboard focus, and SHALL remain revealed while that folder's settings window is open. The toggle SHALL remain present in the DOM and reachable by keyboard at all times, and revealing or hiding it SHALL NOT change the folder row's layout or shift its expand-toggle, icon, or name. Activating the toggle SHALL open the folder's settings window exactly as before, with no change to its click behavior. This requirement applies only to non-root folders; root folders continue to render no settings toggle at all.

#### Scenario: Gear hidden while row is at rest

- **WHEN** a non-root folder row is neither hovered nor keyboard-focused and its settings window is closed
- **THEN** its settings (gear) toggle is not visually shown

#### Scenario: Gear revealed on row hover

- **WHEN** the mouse hovers over any part of a non-root folder's row
- **THEN** its settings (gear) toggle becomes visible without shifting the row's expand-toggle, icon, or name

#### Scenario: Gear revealed on keyboard focus

- **WHEN** the settings toggle receives keyboard focus (e.g. via Tab) while its row is not hovered
- **THEN** the toggle becomes visible so a keyboard user can see and activate it

#### Scenario: Gear stays visible while settings window is open

- **WHEN** a folder's settings window is open
- **THEN** that folder's settings toggle remains visible even if the mouse leaves the row

#### Scenario: Root folders unaffected

- **WHEN** a root folder row is rendered
- **THEN** it displays no settings toggle regardless of hover or focus, unchanged from before

#### Scenario: Activation behavior unchanged

- **WHEN** the user activates the revealed settings toggle
- **THEN** the folder's settings window opens exactly as it did when the toggle was always visible
