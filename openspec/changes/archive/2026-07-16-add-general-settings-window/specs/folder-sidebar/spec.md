## ADDED Requirements

### Requirement: Sidebar Header With General Settings Button
The system SHALL render a header band at the top of the sidebar, above and outside the scrollable folder tree area, so it remains fixed while the folder tree scrolls. The header SHALL contain a settings button rendered as three horizontal lines (a hamburger glyph) pinned to the header's top-right corner. Clicking the button SHALL open the General Settings window. The header SHALL NOT be a folder row: it SHALL NOT appear within the folder tree, SHALL NOT carry a folder name, icon, or expand toggle, and SHALL NOT participate in folder selection, drag, or drop.

#### Scenario: Header stays fixed while the folder tree scrolls
- **WHEN** the folder tree content is taller than the sidebar's visible area and the user scrolls it
- **THEN** the sidebar header and its hamburger button remain fixed in place and do not scroll away

#### Scenario: Hamburger button opens General Settings
- **WHEN** the user clicks the sidebar header's hamburger button
- **THEN** the General Settings window opens

#### Scenario: Header is not a folder row
- **WHEN** the sidebar header renders
- **THEN** it appears outside the folder tree and does not show a folder name, folder icon, or expand toggle, and it is not selectable, draggable, or a drop target

#### Scenario: Hamburger button sits in the top-right corner
- **WHEN** the sidebar header renders
- **THEN** the hamburger button is positioned at the header's top-right corner
